export type AirStatus = "AMAN" | "PERLU_TOPUP" | "KRITIS";

export interface BmeReading {
  suhu: number | null;
  kelembapan: number | null;
  tekanan: number | null;
}

export interface DeviceSnapshot {
  timestamp: Date;
  rtcOk: boolean;
  bmeOk: boolean;
  bme: BmeReading;
  gasGm3: number;
  elapsedHours: number;
  durationUsed: number;
  standardA: number;
  minB: number;
  maxC: number;
  status: AirStatus;
  connected: boolean;
}

export function simulateStatus(gasGm3: number, minB: number, maxC: number): AirStatus {
  if (gasGm3 > maxC) return "KRITIS";
  if (gasGm3 < minB) return "PERLU_TOPUP";
  return "AMAN";
}
