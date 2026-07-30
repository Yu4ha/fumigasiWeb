import { mountApp } from "./shell";
import { DeviceDataConnection, type DeviceMode } from "./deviceData";
import "./style.css";


const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("Elemen #app tidak ditemukan di index.html");
}

// URL relay server diisi lewat env saat build (lihat .env.example).
// Kosongkan / tidak set -> dashboard jalan di mode simulasi.
const DEFAULT_RELAY_URL: string | undefined = import.meta.env.VITE_RELAY_URL;
const mode: DeviceMode = DEFAULT_RELAY_URL ? "live" : "simulated";

const connection = new DeviceDataConnection(mode, DEFAULT_RELAY_URL);

// apiBase dipakai report.ts buat fetch REST ke relay server (histori/laporan).
// Kalau VITE_RELAY_URL belum diisi (mode simulasi), fallback ke localhost:3000
// untuk development lokal -- sesuaikan kalau server-mu jalan di host/port lain.
const apiBase = (DEFAULT_RELAY_URL ?? "http://localhost:3000").replace(/\/$/, "");

mountApp(root, connection, mode, apiBase);
connection.start();
