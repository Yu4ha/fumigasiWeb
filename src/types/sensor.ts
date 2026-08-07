export interface BMEReading {
  suhu: number | null;
  kelembapan: number | null;
  tekanan: number | null;
}

export type AirStatus = "AMAN" | "PERLU_PENAMBAHAN_GAS" | "KRITIS" | "DISTRIBUTING";

export interface DeviceSnapshot {
  timestamp: Date;
  rtcOk: boolean;
  bmeOk: boolean;
  bme: BMEReading;
  gasGm3: number;
  startPointReached: boolean;
  elapsedMinutes: number;
  durationUsed: number;
  standardA: number;
  minB: number;
  maxC: number;
  fuzzyScore: number | null;
  status: AirStatus;
  connected: boolean;
  buzzerActive?: boolean;
}

interface FuzzyDegrees {
  rendah: number;
  sedang: number;
  tinggi: number;
}

function fuzzifyGas(x: number, b: number, a: number, c: number): FuzzyDegrees {
  let rendah = 0;
  if (x <= b) rendah = 1;
  else if (x < a) rendah = (a - x) / (a - b);

  let sedang = 0;
  if (x > b && x < c) {
    sedang = x <= a ? (x - b) / (a - b) : (c - x) / (c - a);
  }

  let tinggi = 0;
  if (x > a) {
    tinggi = x < c ? (x - a) / (c - a) : 1;
  }

  return { rendah, sedang, tinggi };
}

const SKOR_PERLU_TOPUP = 20;
const SKOR_AMAN = 50;
const SKOR_KRITIS = 80;

export function simulateStatus(
  gasGm3: number,
  minB: number,
  standardA: number,
  maxC: number
): { status: AirStatus; fuzzyScore: number } {
  const d = fuzzifyGas(gasGm3, minB, standardA, maxC);
  const total = d.rendah + d.sedang + d.tinggi;
  const skor =
    total < 0.0001
      ? SKOR_AMAN
      : (d.rendah * SKOR_PERLU_TOPUP + d.sedang * SKOR_AMAN + d.tinggi * SKOR_KRITIS) / total;

  let status: AirStatus;
  if (skor >= 65) status = "KRITIS";
  else if (skor <= 35) status = "PERLU_PENAMBAHAN_GAS";
  else status = "AMAN";

  return { status, fuzzyScore: skor };
}
