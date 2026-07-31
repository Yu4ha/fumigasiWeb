import type { DeviceSnapshot } from "./types/sensor";
import { simulateStatus } from "./types/sensor";

// Konfigurasi
const SIMULATED_INTERVAL_MS = 1000;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5000;
const WS_RECONNECT_DELAY_MS = 2000;

// ================== MODE DEMO ==================
// HARUS SAMA dengan nilai di firmware ESP32
const DEMO_UPDATE_INTERVAL_MS = 500;
const DEMO_PHASE_DURATION_MS = 4000; // Sama dengan DEMO_PHASE_DURATION_MS di main.cpp
const DEMO_MIN_B = 10.0;   // Sama dengan DUMMY_THRESHOLD_B di main.cpp
const DEMO_STANDARD_A = 20.0; // Sama dengan DUMMY_THRESHOLD_A di main.cpp
const DEMO_MAX_C = 30.0;   
const DEMO_DURATION_USED = 2;

export type DeviceMode = "simulated" | "demo" | "live";
export type SnapshotListener = (snapshot: DeviceSnapshot) => void;

// ================== INTERFACE API ==================
// Sesuai dengan struktur JSON yang dikirim ESP32 ke /api/ingest
interface ApiIngestData {
  rtcOk: boolean;
  bmeOk: boolean;
  timestamp?: string;
  suhu: number | null;
  kelembapan: number | null;
  tekanan: number | null;
  gasGm3: number;
  elapsedHours: number;
  durationUsed: number;
  standardA: number;
  minB: number;
  maxC: number;
  status: "AMAN" | "PERLU_TOPUP" | "KRITIS";
  buzzerActive: boolean;
}

// Response dari /api/status (sama dengan ApiIngestData + connected)
interface ApiStatusResponse extends ApiIngestData {
  connected?: boolean;
}

// ================== KONSTANTA SIMULASI ==================
const SIM_STANDARD_A = 9.6;
const SIM_MIN_B = 7.1;
const SIM_MAX_C = 12.1;
const SIM_DURATION_USED = 2;

// ================== FUNGSI HELPER ==================
function initialSnapshot(): DeviceSnapshot {
  const gasGm3 = 18;
  return {
    timestamp: new Date(),
    rtcOk: true,
    bmeOk: true,
    bme: { suhu: 29.4, kelembapan: 61.2, tekanan: 1009.8 },
    gasGm3,
    elapsedHours: 0.25,
    durationUsed: SIM_DURATION_USED,
    standardA: SIM_STANDARD_A,
    minB: SIM_MIN_B,
    maxC: SIM_MAX_C,
    status: simulateStatus(gasGm3, SIM_MIN_B, SIM_MAX_C),
    connected: false,
    buzzerActive: false,
  };
}

function toSnapshot(data: ApiStatusResponse, connectedFallback: boolean): DeviceSnapshot {
  return {
    timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
    rtcOk: data.rtcOk,
    bmeOk: data.bmeOk,
    bme: {
      suhu: data.suhu,
      kelembapan: data.kelembapan,
      tekanan: data.tekanan,
    },
    gasGm3: data.gasGm3,
    elapsedHours: data.elapsedHours,
    durationUsed: data.durationUsed,
    standardA: data.standardA,
    minB: data.minB,
    maxC: data.maxC,
    status: data.status,
    connected: data.connected ?? connectedFallback,
    buzzerActive: data.buzzerActive ?? false,
  };
}

function simulateGasGm3(prev: number, standardA: number): number {
  const driftRange = standardA * 0.15;
  const drift = (Math.random() - 0.5) * driftRange;
  const spike = Math.random() < 0.05 ? (Math.random() - 0.3) * standardA : 0;
  const next = prev + drift + spike;
  const ceiling = standardA * 1.5;
  return Math.min(ceiling, Math.max(0, Number(next.toFixed(3))));
}

// Nilai gas dummy per fase, SAMA dengan updateGas() di main.cpp
function demoGasForPhase(phase: number): number {
  switch (phase) {
    case 0:
      return DEMO_STANDARD_A; // AMAN
    case 1:
      return DEMO_MIN_B - 3.0; // PERLU_TOPUP
    default:
      return DEMO_MAX_C + 8.0; // KRITIS
  }
}

// Fase dihitung dari wall-clock, SAMA dengan currentDemoPhase() di main.cpp
function currentDemoPhase(): number {
  return Math.floor(Date.now() / DEMO_PHASE_DURATION_MS) % 3;
}

// ================== CLASS MAIN ==================
export class DeviceDataConnection {
  private mode: DeviceMode;
  private baseUrl: string | undefined;
  private listeners = new Set<SnapshotListener>();
  private snapshot: DeviceSnapshot = initialSnapshot();

  private simInterval: ReturnType<typeof setInterval> | null = null;
  private gasRef = 18;

  private demoInterval: ReturnType<typeof setInterval> | null = null;

  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private usingPollFallback = false;
  private stopped = false;

  constructor(mode: DeviceMode, baseUrl?: string) {
    this.mode = mode;
    this.baseUrl = baseUrl;
  }

  getSnapshot(): DeviceSnapshot {
    return this.snapshot;
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  private emit(snapshot: DeviceSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((l) => l(snapshot));
  }

  start() {
    this.stopped = false;
    if (this.mode === "simulated") {
      this.startSimulated();
    } else if (this.mode === "demo") {
      this.startDemo();
    } else if (this.baseUrl) {
      this.startLive(this.baseUrl);
    }
  }

  stop() {
    this.stopped = true;
    if (this.simInterval) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }

    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }

    this.ws?.close();
    this.ws = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.usingPollFallback = false;
  }

  // ================== MODE SIMULATED ==================
  private startSimulated() {
    this.emit({ ...this.snapshot, connected: true });

    this.simInterval = setInterval(() => {
      this.gasRef = simulateGasGm3(this.gasRef, SIM_STANDARD_A);
      const gasGm3 = this.gasRef;

      this.emit({
        timestamp: new Date(),
        rtcOk: true,
        bmeOk: true,
        bme: {
          suhu: 28.5 + Math.sin(Date.now() / 60000) * 1.5,
          kelembapan: 58 + Math.cos(Date.now() / 45000) * 4,
          tekanan: 1008 + Math.sin(Date.now() / 90000) * 2,
        },
        gasGm3,
        elapsedHours: 0.25,
        durationUsed: SIM_DURATION_USED,
        standardA: SIM_STANDARD_A,
        minB: SIM_MIN_B,
        maxC: SIM_MAX_C,
        status: simulateStatus(gasGm3, SIM_MIN_B, SIM_MAX_C),
        connected: true,
        buzzerActive: gasGm3 > SIM_MAX_C,
      });
    }, SIMULATED_INTERVAL_MS);
  }

  // ================== MODE DEMO ==================
  private startDemo() {
    const tick = () => {
      const phase = currentDemoPhase();
      const gasGm3 = demoGasForPhase(phase);

      this.emit({
        timestamp: new Date(),
        rtcOk: true,
        bmeOk: true,
        bme: {
          suhu: 28.5 + Math.sin(Date.now() / 60000) * 1.5,
          kelembapan: 58 + Math.cos(Date.now() / 45000) * 4,
          tekanan: 1008 + Math.sin(Date.now() / 90000) * 2,
        },
        gasGm3,
        elapsedHours: 0,
        durationUsed: DEMO_DURATION_USED,
        standardA: DEMO_STANDARD_A,
        minB: DEMO_MIN_B,
        maxC: DEMO_MAX_C,
        status: simulateStatus(gasGm3, DEMO_MIN_B, DEMO_MAX_C),
        connected: true,
        buzzerActive: gasGm3 > DEMO_MAX_C,
      });
    };

    tick();
    this.demoInterval = setInterval(tick, DEMO_UPDATE_INTERVAL_MS);
  }

  // ================== MODE LIVE ==================
  private startLive(baseUrl: string) {
    const pollOnce = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/status`, {
          signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: ApiStatusResponse = await res.json();
        if (this.stopped) return;
        this.emit(toSnapshot(data, true));
      } catch (error) {
        if (this.stopped) return;
        console.warn("Polling failed:", error);
        this.emit({ ...this.snapshot, connected: false });
      }
    };

    const startPollFallback = () => {
      if (this.usingPollFallback) return;
      this.usingPollFallback = true;
      pollOnce();
      this.pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS);
    };

    const stopPollFallback = () => {
      this.usingPollFallback = false;
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    };

    const connectWs = () => {
      if (this.stopped) return;

      const wsUrl = `${baseUrl.replace(/^http/, "ws")}/ws`;
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        stopPollFallback();
      };

      ws.onmessage = (event) => {
        if (this.stopped) return;
        try {
          const data: ApiStatusResponse = JSON.parse(event.data);
          this.emit(toSnapshot(data, true));
        } catch (error) {
          console.warn("Failed to parse WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        ws.close();
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
        if (this.stopped) return;
        startPollFallback();
        this.reconnectTimer = setTimeout(connectWs, WS_RECONNECT_DELAY_MS);
      };
    };

    connectWs();
    startPollFallback();
  }
}

// ================== FACTORY FUNCTIONS ==================
export function createSimulatedConnection(): DeviceDataConnection {
  return new DeviceDataConnection("simulated");
}

export function createDemoConnection(): DeviceDataConnection {
  return new DeviceDataConnection("demo");
}

export function createLiveConnection(baseUrl: string): DeviceDataConnection {
  return new DeviceDataConnection("live", baseUrl);
}
