// types/sensor.ts
// Tipe data ini mengikuti struktur variabel pada firmware ESP32
// (RTC DS3231, BME280, MQ135, threshold status di updateStatus()).
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
  gasValue: number; // ADC MQ135, 0-4095
  status: AirStatus;
  connected: boolean; // status koneksi ke relay server
}

// Threshold identik dengan updateStatus() di firmware:
// < 1000 => AMAN, < 3000 => WASPADA, selainnya => BAHAYA
export function classifyGas(gasValue: number): AirStatus {
  if (gasValue < 1000) return "AMAN";
  if (gasValue < 3000) return "WASPADA";
  return "BAHAYA";
}
