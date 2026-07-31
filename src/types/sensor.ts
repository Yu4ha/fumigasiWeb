// types/sensor.ts
export interface BMEReading {
  suhu: number | null;
  kelembapan: number | null;
  tekanan: number | null;
}

export interface DeviceSnapshot {
  timestamp: Date;
  rtcOk: boolean;
  bmeOk: boolean;
  bme: BMEReading;
  gasGm3: number;
  elapsedHours: number;
  durationUsed: number;
  standardA: number;
  minB: number;
  maxC: number;
  status: "AMAN" | "PERLU_TOPUP" | "KRITIS";
  connected: boolean;
  buzzerActive?: boolean;
}

export function simulateStatus(
  gasGm3: number,
  minB: number,
  maxC: number
): "AMAN" | "PERLU_TOPUP" | "KRITIS" {
  if (gasGm3 < minB) return "PERLU_TOPUP";
  if (gasGm3 > maxC) return "KRITIS";
  return "AMAN";
}
