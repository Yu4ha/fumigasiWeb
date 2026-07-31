// types/sensor.ts
// Tipe data ini mengikuti payload yang dikirim server (yang notabene cuma
// meneruskan hasil hitung firmware ESP32, lihat main.cpp & server.ts).
//
// PENTING: web ini TIDAK menghitung status apa pun. classifyGas() di bawah
// cuma dipakai buat MODE SIMULASI (preview UI tanpa alat fisik) - saat mode
// live, status selalu dipakai apa adanya dari server (device yang menentukan).
export type AirStatus = "AMAN" | "PERHATIAN" | "KRITIS";

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
  gasGm3: number; // hasil Rs/Ro -> ppm -> g/m3 (Butana), dihitung di firmware
  elapsedHours: number;
  hourUsed: number;
  retentionPct: number;
  standardA: number; // ambang standar dosis (A)
  minB: number;       // ambang minimum (B)
  maxC: number;        // ambang maksimum (C)
  status: AirStatus;   // dikirim APA ADANYA dari device, bukan dihitung di web
  connected: boolean;  // status koneksi ke relay server
}

// HANYA dipakai untuk mode simulasi (preview UI). TIDAK dipakai saat live,
// karena saat live status datang langsung dari device lewat server.
export function simulateStatus(gasGm3: number, standardA: number, maxC: number): AirStatus {
  if (gasGm3 > maxC) return "KRITIS";
  if (gasGm3 > standardA) return "PERHATIAN";
  return "AMAN";
}
