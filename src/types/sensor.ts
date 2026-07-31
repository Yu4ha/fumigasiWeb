// types/sensor.ts
// Tipe data ini mengikuti struktur variabel pada firmware ESP32
// (RTC DS3231, BME280, MQ-6, threshold status di updateStatus()).
export type AirStatus = "AMAN" | "WASPADA" | "BAHAYA";

export interface BmeReading {
  suhu: number | null; // Celsius, null jika bmeOK == false
  kelembapan: number | null; // %
  tekanan: number | null; // hPa
}

export interface DeviceSnapshot {
  timestamp: Date;
  rtcOk: boolean;
  bmeOk: boolean;
  bme: BmeReading;
  gasGm3: number; // hasil Rs/Ro -> ppm -> g/m3 (Butana), BUKAN ADC mentah lagi
  status: AirStatus;
  connected: boolean; // status koneksi ke relay server
}

// Threshold berbasis 10%/20% LEL Butana, identik dengan main.cpp:
// LEL Butana ~1.8% vol = 18000 ppm -> g/m3 pakai BM=58 (0.002372 g/m3/ppm)
const PPM_TO_GM3_BUTANA = 58 / 24450; // 0.002372
export const GM3_WASPADA = 0.1 * 18000 * PPM_TO_GM3_BUTANA; // ~4.27 g/m3 (10% LEL)
export const GM3_BAHAYA = 0.2 * 18000 * PPM_TO_GM3_BUTANA; // ~8.54 g/m3 (20% LEL)

export function classifyGas(gasGm3: number): AirStatus {
  if (gasGm3 < GM3_WASPADA) return "AMAN";
  if (gasGm3 < GM3_BAHAYA) return "WASPADA";
  return "BAHAYA";
}
