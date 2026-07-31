import type { AirStatus, DeviceSnapshot } from "./types/sensor";
import { GM3_WASPADA, GM3_BAHAYA } from "./types/sensor";
import type { DeviceDataConnection, DeviceMode } from "./deviceData";

const STATUS_LABEL: Record<AirStatus, string> = {
  AMAN: "AMAN",
  WASPADA: "WASPADA",
  BAHAYA: "BAHAYA",
};

const STATUS_DESC: Record<AirStatus, string> = {
  AMAN: "Kadar gas dalam batas normal",
  WASPADA: "Kadar gas meningkat, pantau terus",
  BAHAYA: "Kadar gas melebihi batas aman",
};

// Skala penuh bar disamakan dengan ambang BAHAYA + buffer, dibulatkan.
const GAS_BAR_MAX = Math.ceil(GM3_BAHAYA * 1.4); // ~12 g/m3

function formatTanggal(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function formatJam(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mi}:${ss}`;
}

function fmt(value: number | null, digits: number, unit: string): string {
  return value === null ? "N/A" : `${value.toFixed(digits)} ${unit}`;
}

// connection dibuat & di-start() oleh main.ts, dashboard cuma subscribe.
export function mountDashboard(root: HTMLElement, connection: DeviceDataConnection, mode: DeviceMode) {
  root.innerHTML = `
    <div class="fw-dash">
      <header class="fw-titlebar">
        <div class="fw-titlebar-left">
          <span class="fw-plate">FW-01</span>
          <h1>Monitoring Kualitas Udara</h1>
        </div>
        <div id="fw-conn" class="fw-conn is-offline">
          <span class="fw-conn-dot"></span>
          <span id="fw-conn-text">Mode simulasi</span>
        </div>
      </header>

      <div class="fw-grid">
        <section class="fw-panel fw-panel-clock">
          <h2>Tanggal &amp; Jam</h2>
          <div id="fw-clock-date" class="fw-clock-date">-</div>
          <div id="fw-clock-time" class="fw-clock-time">-</div>
          <div id="fw-rtc-tag" class="fw-tag">-</div>
        </section>

        <section class="fw-panel fw-panel-bme">
          <h2>Sensor BME280</h2>
          <div class="fw-readout-row">
            <span class="fw-readout-label">Suhu</span>
            <span id="fw-suhu" class="fw-readout-value">-</span>
          </div>
          <div class="fw-readout-row">
            <span class="fw-readout-label">Kelembapan</span>
            <span id="fw-kelembapan" class="fw-readout-value">-</span>
          </div>
          <div class="fw-readout-row">
            <span class="fw-readout-label">Tekanan</span>
            <span id="fw-tekanan" class="fw-readout-value">-</span>
          </div>
          <div id="fw-bme-tag" class="fw-tag">-</div>
        </section>

        <section class="fw-panel fw-panel-gas">
          <h2>MQ-6 (g/m&sup3;)</h2>
          <div id="fw-gas-value" class="fw-gas-value">-</div>
          <div class="fw-gas-bar">
            <div id="fw-gas-bar-fill" class="fw-gas-bar-fill"></div>
          </div>
          <div class="fw-gas-scale">
            <span>0</span>
            <span>${GM3_WASPADA.toFixed(2)}</span>
            <span>${GM3_BAHAYA.toFixed(2)}</span>
            <span>${GAS_BAR_MAX}</span>
          </div>
        </section>

        <section id="fw-status-panel" class="fw-panel fw-panel-status">
          <h2>Status Kualitas Udara</h2>
          <div class="fw-status-row">
            <span id="fw-status-label" class="fw-status-label">-</span>
            <span id="fw-status-desc" class="fw-status-desc">-</span>
            <div class="fw-led-array">
              <span id="fw-led-green" class="fw-led fw-led-green"></span>
              <span id="fw-led-amber" class="fw-led fw-led-amber"></span>
              <span id="fw-led-red" class="fw-led fw-led-red"></span>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;

  const connEl = root.querySelector<HTMLDivElement>("#fw-conn")!;
  const connText = root.querySelector<HTMLSpanElement>("#fw-conn-text")!;

  function render(snap: DeviceSnapshot) {
    const gasPct = Math.min(100, Math.round((snap.gasGm3 / GAS_BAR_MAX) * 100));
    const statusKey = snap.status.toLowerCase();

    connEl.className = `fw-conn ${snap.connected ? "is-online" : "is-offline"}`;
    connText.textContent =
      mode === "simulated"
        ? "Mode simulasi"
        : snap.connected
          ? "Perangkat terhubung"
          : "Perangkat terputus";

    root.querySelector("#fw-clock-date")!.textContent = formatTanggal(snap.timestamp);
    root.querySelector("#fw-clock-time")!.textContent = formatJam(snap.timestamp);
    const rtcTag = root.querySelector("#fw-rtc-tag")!;
    rtcTag.textContent = snap.rtcOk ? "RTC OK" : "RTC ERROR";
    rtcTag.className = `fw-tag ${snap.rtcOk ? "ok" : "err"}`;

    root.querySelector("#fw-suhu")!.textContent = fmt(snap.bme.suhu, 1, "C");
    root.querySelector("#fw-kelembapan")!.textContent = fmt(snap.bme.kelembapan, 1, "%");
    root.querySelector("#fw-tekanan")!.textContent = fmt(snap.bme.tekanan, 1, "hPa");
    const bmeTag = root.querySelector("#fw-bme-tag")!;
    bmeTag.textContent = snap.bmeOk ? "BME280 OK" : "BME280 ERROR";
    bmeTag.className = `fw-tag ${snap.bmeOk ? "ok" : "err"}`;

    root.querySelector("#fw-gas-value")!.textContent = `${snap.gasGm3.toFixed(2)} g/m³`;
    const gasBarFill = root.querySelector<HTMLDivElement>("#fw-gas-bar-fill")!;
    gasBarFill.style.width = `${gasPct}%`;
    gasBarFill.className = `fw-gas-bar-fill status-${statusKey}`;

    const statusPanel = root.querySelector("#fw-status-panel")!;
    statusPanel.className = `fw-panel fw-panel-status status-${statusKey}`;
    root.querySelector("#fw-status-label")!.textContent = STATUS_LABEL[snap.status];
    root.querySelector("#fw-status-desc")!.textContent = STATUS_DESC[snap.status];

    root.querySelector("#fw-led-green")!.className =
      `fw-led fw-led-green ${snap.status === "AMAN" ? "is-lit" : ""}`;
    root.querySelector("#fw-led-amber")!.className =
      `fw-led fw-led-amber ${snap.status === "WASPADA" ? "is-lit" : ""}`;
    root.querySelector("#fw-led-red")!.className =
      `fw-led fw-led-red ${snap.status === "BAHAYA" ? "is-lit" : ""}`;
  }

  connection.subscribe(render);
}
