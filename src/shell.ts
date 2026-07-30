// shell.ts
// Tab navigasi: "Dashboard" (realtime) <-> "Riwayat Fumigasi" (report.ts).
//
// CATATAN INTEGRASI:
// Di main.ts kamu, ganti pemanggilan langsung:
//     mountDashboard(root, connection, mode);
// menjadi:
//     mountApp(root, connection, mode);
// Import & setup DeviceDataConnection tetap sama seperti sekarang, cuma
// dioper ke sini.

import { mountDashboard } from "./dashboard.js";
import { mountFumigationReport } from "./report.js";
import type { DeviceDataConnection, DeviceMode } from "./deviceData.js";

type TabKey = "dashboard" | "report";

export function mountApp(root: HTMLElement, connection: DeviceDataConnection, mode: DeviceMode): void {
    root.innerHTML = `
    <div class="fw-shell">
      <nav class="fw-tabs">
        <button type="button" class="fw-tab is-active" data-tab="dashboard">Dashboard</button>
        <button type="button" class="fw-tab" data-tab="report">Riwayat Fumigasi</button>
      </nav>
      <div id="fw-tab-content" class="fw-tab-content"></div>
    </div>
  `;

    const tabButtons = root.querySelectorAll<HTMLButtonElement>(".fw-tab");
    const content = root.querySelector<HTMLDivElement>("#fw-tab-content")!;

    function renderTab(tab: TabKey): void {
        tabButtons.forEach((btn) => {
            btn.classList.toggle("is-active", btn.dataset.tab === tab);
        });

        if (tab === "dashboard") {
            mountDashboard(content, connection, mode);
        } else {
            mountFumigationReport(content);
        }
    }

    tabButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            renderTab(btn.dataset.tab as TabKey);
        });
    });

    renderTab("dashboard"); // tab default saat pertama kali dibuka
}
