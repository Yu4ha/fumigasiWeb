// types/sensor.ts
export interface BMEReading {
  suhu: number | null;
  kelembapan: number | null;
  tekanan: number | null;
}

export type AirStatus = "AMAN" | "PERLU_TOPUP" | "KRITIS";

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
  status: AirStatus;
  connected: boolean;
  buzzerActive?: boolean;
}

export function simulateStatus(
  gasGm3: number,
  minB: number,
  maxC: number
): AirStatus {
  if (gasGm3 < minB) return "PERLU_TOPUP";
  if (gasGm3 > maxC) return "KRITIS";
  return "AMAN";
}
