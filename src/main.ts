import { mountApp } from "./shell";
import { DeviceDataConnection, type DeviceMode } from "./deviceData";
import "./style.css";
import "./report.css"
import "./shell.css"


const root = document.querySelector<HTMLDivElement>("#app");
if (!root) {
  throw new Error("Elemen #app tidak ditemukan di index.html");
}

// URL relay server diisi lewat env saat build (lihat .env.example).
// Kosongkan / tidak set -> dashboard jalan di mode simulasi.
const DEFAULT_RELAY_URL: string | undefined = import.meta.env.VITE_RELAY_URL;
const mode: DeviceMode = DEFAULT_RELAY_URL ? "live" : "simulated";

const connection = new DeviceDataConnection(mode, DEFAULT_RELAY_URL);
mountApp(root, connection, mode);
connection.start();
