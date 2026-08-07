type GasStatus = "AMAN" | "PERLU_PENAMBAHAN_GAS" | "KRITIS" | "DISTRIBUTING";

interface SessionRow {
    id: number;
    label: string | null;
    initial_dose: number;
    duration_hours: number;
    start_point_at: string;
    ended_at: string | null;
    is_active: boolean;
    created_at: string;
    operator_supervisor: string | null;
    operator_helper1: string | null;
    operator_helper2: string | null;
    location: string | null;
    container_p: number | null;
    container_l: number | null;
    container_t: number | null;
}

interface SessionSummary {
    session: SessionRow;
    total_readings: number;
    count_aman: number;
    count_perlu_topup: number;
    count_kritis: number;
    count_distributing: number;
    min_gas: number | null;
    max_gas: number | null;
    avg_gas: number | null;
    duration_minutes: number | null;
}

interface ReadingRow {
    id: number;
    session_id: number;
    sensor_value: number;
    standard_a: number;
    min_b: number;
    max_c: number;
    fuzzy_score: number | null;
    status: GasStatus;
    created_at: string;
}

function computeVolumeM3(
    p: number | null,
    l: number | null,
    t: number | null
): number | null {
    if (p == null || l == null || t == null) return null;
    return p * l * t;
}

function computeTotalGasGrams(doseGm3: number, volumeM3: number | null): number | null {
    if (volumeM3 == null) return null;
    return doseGm3 * volumeM3;
}

function fmtDate(iso: string | null): string {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("id-ID");
}

function fmtFuzzy(score: number | null): string {
    return score !== null ? Number(score).toFixed(1) : "-";
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    return node;
}

const NGROK_HEADERS = { "ngrok-skip-browser-warning": "true" } as const;

export function mountFumigationReport(root: HTMLElement, apiBase: string): void {
    root.innerHTML = `
    <div class="fw-dash fw-report">
      <header class="fw-titlebar">
        <div class="fw-titlebar-left">
          <span class="fw-plate">FW-01</span>
          <h1>Riwayat &amp; Laporan Fumigasi</h1>
        </div>
      </header>

      <section class="fw-panel fw-panel-form">
        <h2>Mulai Sesi Baru</h2>
        <form id="fw-session-form" class="fw-form">
          <div class="fw-form-row">
            <label>Nama Operator</label>
            <div class="fw-form-cols">
              <input name="operatorSupervisor" placeholder="Supervisor" />
              <input name="operatorHelper1" placeholder="Helper 1" />
              <input name="operatorHelper2" placeholder="Helper 2" />
            </div>
          </div>

          <div class="fw-form-row">
            <label for="fw-location">Tempat / Lokasi</label>
            <input id="fw-location" name="location" placeholder="Mis. Gudang A, Pelabuhan Tanjung Priok" />
          </div>

          <div class="fw-form-row">
            <label>Dimensi Container P x L x T (meter)</label>
            <div class="fw-form-cols fw-form-cols-3">
              <input name="containerP" type="number" step="0.01" placeholder="Panjang" />
              <input name="containerL" type="number" step="0.01" placeholder="Lebar" />
              <input name="containerT" type="number" step="0.01" placeholder="Tinggi" />
            </div>
          </div>

          <div class="fw-form-row">
            <label for="fw-dose">Takaran Gas (Dosis Standar, g/m³)</label>
            <select id="fw-dose" name="initialDose" required>
              <option value="" disabled selected>Pilih dosis...</option>
              <option value="16">16 g/m³</option>
              <option value="20">20 g/m³</option>
              <option value="24">24 g/m³</option>
              <option value="28">28 g/m³</option>
              <option value="32">32 g/m³</option>
              <option value="36">36 g/m³</option>
              <option value="40">40 g/m³</option>
              <option value="44">44 g/m³</option>
              <option value="64">64 g/m³</option>
            </select>
          </div>

          <div class="fw-form-row">
            <label for="fw-duration">Durasi Fumigasi</label>
            <select id="fw-duration" name="durationHours" required>
              <option value="" disabled selected>Pilih durasi...</option>
              <option value="2">2 menit</option>
              <option value="4">4 menit</option>
              <option value="12">12 menit</option>
              <option value="24">24 menit</option>
              <option value="48">48 menit</option>
            </select>
          </div>

          <div class="fw-form-row fw-computed-box">
            <div>Volume container: <b id="fw-computed-volume">-</b> m³</div>
            <div>Total gas dibutuhkan: <b id="fw-computed-gas">-</b> gram</div>
            <div class="fw-computed-hint">
              Dosis (g/m³) dan durasi dipakai sebagai acuan ambang batas AMAN/PERLU TOP-UP/KRITIS.
              Total gas (gram) cuma info bantu takaran fisik, dihitung otomatis dari Dosis × Volume.
            </div>
          </div>

          <div class="fw-form-row">
            <label for="fw-label">Catatan / Label sesi (opsional)</label>
            <input id="fw-label" name="label" placeholder="Mis. Uji coba gas korek #1" />
          </div>

          <button type="submit" class="fw-btn fw-btn-primary">Mulai Sesi Fumigasi</button>
          <span id="fw-form-msg" class="fw-form-msg"></span>
        </form>
      </section>

      <section class="fw-panel fw-panel-history">
        <h2>Riwayat Sesi</h2>
        <div id="fw-session-list" class="fw-session-list">Memuat...</div>
      </section>

      <section class="fw-panel fw-panel-filter">
        <h2>Cari / Filter Data Pembacaan</h2>
        <form id="fw-filter-form" class="fw-form fw-filter-form">
          <div class="fw-form-row">
            <label for="fw-filter-session">Sesi</label>
            <select id="fw-filter-session" name="sessionId">
              <option value="">Semua sesi</option>
            </select>
          </div>
          <div class="fw-form-row">
            <label for="fw-filter-status">Status</label>
            <select id="fw-filter-status" name="status">
              <option value="">Semua status</option>
              <option value="DISTRIBUTING">DISTRIBUSI GAS</option>
              <option value="AMAN">AMAN</option>
              <option value="PERLU_PENAMBAHAN_GAS">PERLU PENAMBAHAN GAS</option>
              <option value="KRITIS">KRITIS</option>
            </select>
          </div>
          <div class="fw-form-row">
            <label>Rentang tanggal</label>
            <div class="fw-form-cols">
              <input type="date" name="from" />
              <input type="date" name="to" />
            </div>
          </div>
          <button type="submit" class="fw-btn fw-btn-primary">Cari</button>
        </form>
        <div id="fw-filter-results"></div>
      </section>

      <section id="fw-detail-panel" class="fw-panel fw-panel-detail" hidden>
        <h2 id="fw-detail-title">Detail Sesi</h2>
        <div id="fw-detail-body"></div>
      </section>
    </div>
  `;

    const form = root.querySelector<HTMLFormElement>("#fw-session-form")!;
    const formMsg = root.querySelector<HTMLSpanElement>("#fw-form-msg")!;
    const listEl = root.querySelector<HTMLDivElement>("#fw-session-list")!;
    const detailPanel = root.querySelector<HTMLElement>("#fw-detail-panel")!;
    const detailTitle = root.querySelector<HTMLHeadingElement>("#fw-detail-title")!;
    const detailBody = root.querySelector<HTMLDivElement>("#fw-detail-body")!;
    const filterForm = root.querySelector<HTMLFormElement>("#fw-filter-form")!;
    const filterSessionSelect = root.querySelector<HTMLSelectElement>("#fw-filter-session")!;
    const filterResults = root.querySelector<HTMLDivElement>("#fw-filter-results")!;
    const volumeOut = root.querySelector<HTMLElement>("#fw-computed-volume")!;
    const gasOut = root.querySelector<HTMLElement>("#fw-computed-gas")!;

    function recomputeVolumeAndGas(): void {
        const fd = new FormData(form);
        const p = Number(fd.get("containerP"));
        const l = Number(fd.get("containerL"));
        const t = Number(fd.get("containerT"));
        const dose = Number(fd.get("initialDose"));

        if (p > 0 && l > 0 && t > 0) {
            const volume = p * l * t;
            volumeOut.textContent = volume.toFixed(4);
            gasOut.textContent = dose > 0 ? (dose * volume).toFixed(3) : "-";
        } else {
            volumeOut.textContent = "-";
            gasOut.textContent = "-";
        }
    }

    form.querySelectorAll('[name="containerP"], [name="containerL"], [name="containerT"], [name="initialDose"]').forEach(
        (input) => input.addEventListener("input", recomputeVolumeAndGas)
    );

    async function refreshList(): Promise<void> {
        listEl.textContent = "Memuat...";
        try {
            const res = await fetch(`${apiBase}/api/sessions`, { headers: NGROK_HEADERS });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const sessions: SessionRow[] = await res.json();
            renderList(sessions);
            renderFilterSessionOptions(sessions);
        } catch (err) {
            listEl.textContent = "Gagal memuat riwayat sesi. Cek koneksi ke server.";
            console.error(err);
        }
    }

    function renderFilterSessionOptions(sessions: SessionRow[]): void {
        const current = filterSessionSelect.value;
        filterSessionSelect.innerHTML = `<option value="">Semua sesi</option>`;
        sessions.forEach((s) => {
            const opt = el("option");
            opt.value = String(s.id);
            opt.textContent = `#${s.id}${s.label ? " · " + s.label : ""}`;
            filterSessionSelect.appendChild(opt);
        });
        filterSessionSelect.value = current;
    }

    function renderList(sessions: SessionRow[]): void {
        listEl.innerHTML = "";
        if (sessions.length === 0) {
            listEl.textContent = "Belum ada sesi fumigasi tercatat.";
            return;
        }

        sessions.forEach((s) => {
            const card = el("div", `fw-session-card ${s.is_active ? "is-active" : ""}`);

            const dims =
                s.container_p || s.container_l || s.container_t
                    ? `${s.container_p ?? "-"} x ${s.container_l ?? "-"} x ${s.container_t ?? "-"} m`
                    : "-";

            const volume = computeVolumeM3(s.container_p, s.container_l, s.container_t);
            const totalGas = computeTotalGasGrams(s.initial_dose, volume);

            card.innerHTML = `
        <div class="fw-session-card-head">
          <span class="fw-session-id">#${s.id}${s.label ? " · " + escapeHtml(s.label) : ""}</span>
          <span class="fw-session-badge ${s.is_active ? "badge-active" : "badge-ended"}">
            ${s.is_active ? "AKTIF" : "SELESAI"}
          </span>
        </div>
        <div class="fw-session-card-body">
          <div><b>Operator:</b> ${escapeHtml(s.operator_supervisor ?? "-")} / ${escapeHtml(
                s.operator_helper1 ?? "-"
            )} / ${escapeHtml(s.operator_helper2 ?? "-")}</div>
          <div><b>Lokasi:</b> ${escapeHtml(s.location ?? "-")}</div>
          <div><b>Kontainer (PxLxT):</b> ${dims}</div>
          <div><b>Volume:</b> ${volume !== null ? volume.toFixed(4) : "-"} m³ · <b>Total gas:</b> ${
                totalGas !== null ? totalGas.toFixed(3) : "-"
            } gram</div>
          <div><b>Takaran gas:</b> ${s.initial_dose} g/m³ (durasi ${s.duration_hours} menit)</div>
          <div><b>Mulai:</b> ${fmtDate(s.start_point_at)}</div>
          <div><b>Selesai:</b> ${fmtDate(s.ended_at)}</div>
        </div>
        <div class="fw-session-card-actions">
          <button class="fw-btn fw-btn-small" data-action="detail" data-id="${s.id}">Lihat Laporan</button>
          <button class="fw-btn fw-btn-small" data-action="pdf" data-id="${s.id}">Cetak PDF</button>
          ${
              s.is_active
                  ? `<button class="fw-btn fw-btn-small fw-btn-danger" data-action="stop" data-id="${s.id}">Hentikan Sesi</button>`
                  : ""
          }
        </div>
      `;
            listEl.appendChild(card);
        });
    }

    listEl.addEventListener("click", async (e) => {
        const target = e.target as HTMLElement;
        const action = target.dataset.action;
        const id = target.dataset.id ? Number(target.dataset.id) : null;
        if (!action || id === null) return;

        if (action === "stop") {
            if (!confirm(`Hentikan sesi #${id}?`)) return;
            try {
                const res = await fetch(`${apiBase}/api/sessions/${id}/stop`, {
                    method: "POST",
                    headers: NGROK_HEADERS,
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                await refreshList();
            } catch (err) {
                alert("Gagal menghentikan sesi.");
                console.error(err);
            }
        }

        if (action === "detail") {
            await showDetail(id);
        }

        if (action === "pdf") {
            const btn = target as HTMLButtonElement;
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Menyiapkan PDF...";
            try {
                const res = await fetch(`${apiBase}/api/sessions/${id}/report/pdf`, {
                    headers: NGROK_HEADERS,
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank", "noopener");
                setTimeout(() => URL.revokeObjectURL(url), 30000);
            } catch (err) {
                alert("Gagal membuka PDF.");
                console.error(err);
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }
    });

    async function showDetail(id: number): Promise<void> {
        detailPanel.hidden = false;
        detailTitle.textContent = `Detail Sesi #${id}`;
        detailBody.textContent = "Memuat...";
        detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });

        try {
            const res = await fetch(`${apiBase}/api/sessions/${id}/report`, { headers: NGROK_HEADERS });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: { summary: SessionSummary; readings: ReadingRow[] } = await res.json();
            renderDetail(data.summary, data.readings);
        } catch (err) {
            detailBody.textContent = "Gagal memuat detail laporan.";
            console.error(err);
        }
    }

    function renderDetail(summary: SessionSummary, readings: ReadingRow[]): void {
        const rowsHtml = readings
            .map(
                (r) => `
        <tr class="row-${r.status.toLowerCase()}">
          <td>${fmtDate(r.created_at)}</td>
          <td>${r.sensor_value}</td>
          <td>${r.standard_a}</td>
          <td>${r.min_b}</td>
          <td>${r.max_c}</td>
          <td>${fmtFuzzy(r.fuzzy_score)}</td>
          <td>${r.status}</td>
        </tr>`
            )
            .join("");

        detailBody.innerHTML = `
      <div class="fw-detail-summary">
        <div>Total pembacaan: <b>${summary.total_readings}</b></div>
        <div>Fase distribusi: <b>${summary.count_distributing}</b></div>
        <div>AMAN: <b>${summary.count_aman}</b> · PERLU TOP-UP: <b>${summary.count_perlu_topup}</b> · KRITIS: <b>${summary.count_kritis}</b></div>
        <div>Nilai sensor (fase fumigasi) min/max/rata-rata: <b>${summary.min_gas ?? "-"} / ${summary.max_gas ?? "-"} / ${
            summary.avg_gas !== null ? summary.avg_gas.toFixed(2) : "-"
        }</b></div>
        <div>Durasi: <b>${summary.duration_minutes ?? "-"} menit</b></div>
      </div>
      <table class="fw-detail-table">
        <thead>
          <tr><th>Waktu</th><th>Sensor</th><th>A</th><th>B</th><th>C</th><th>Skor Fuzzy</th><th>Status</th></tr>
        </thead>
        <tbody>${rowsHtml || `<tr><td colspan="7">Belum ada data pembacaan.</td></tr>`}</tbody>
      </table>
    `;
    }

    filterForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        filterResults.innerHTML = "Mencari...";

        const fd = new FormData(filterForm);
        const params = new URLSearchParams();

        const sessionId = fd.get("sessionId");
        if (sessionId) params.set("sessionId", String(sessionId));

        const status = fd.get("status");
        if (status) params.set("status", String(status));

        const from = fd.get("from");
        if (from) params.set("from", new Date(String(from)).toISOString());

        const to = fd.get("to");
        if (to) {
            const toDate = new Date(String(to));
            toDate.setHours(23, 59, 59, 999);
            params.set("to", toDate.toISOString());
        }

        try {
            const res = await fetch(`${apiBase}/api/readings?${params.toString()}`, {
                headers: NGROK_HEADERS,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const readings: ReadingRow[] = await res.json();
            renderFilterResults(readings);
        } catch (err) {
            filterResults.innerHTML = "Gagal mencari data. Cek koneksi ke server.";
            console.error(err);
        }
    });

    function renderFilterResults(readings: ReadingRow[]): void {
        if (readings.length === 0) {
            filterResults.innerHTML = `<p>Tidak ada data yang cocok dengan filter.</p>`;
            return;
        }

        const rowsHtml = readings
            .map(
                (r) => `
        <tr class="row-${r.status.toLowerCase()}">
          <td>${fmtDate(r.created_at)}</td>
          <td>#${r.session_id}</td>
          <td>${r.sensor_value}</td>
          <td>${r.standard_a}</td>
          <td>${r.min_b}</td>
          <td>${r.max_c}</td>
          <td>${fmtFuzzy(r.fuzzy_score)}</td>
          <td>${r.status}</td>
        </tr>`
            )
            .join("");

        filterResults.innerHTML = `
      <p>${readings.length} data ditemukan (maks. 500 ditampilkan).</p>
      <table class="fw-detail-table">
        <thead>
          <tr><th>Waktu</th><th>Sesi</th><th>Sensor</th><th>A</th><th>B</th><th>C</th><th>Skor Fuzzy</th><th>Status</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        formMsg.textContent = "Mengirim...";
        formMsg.className = "fw-form-msg";

        const fd = new FormData(form);
        const body = {
            label: String(fd.get("label") || "") || undefined,
            initialDose: Number(fd.get("initialDose")),
            durationHours: Number(fd.get("durationHours")),
            operatorSupervisor: String(fd.get("operatorSupervisor") || "") || undefined,
            operatorHelper1: String(fd.get("operatorHelper1") || "") || undefined,
            operatorHelper2: String(fd.get("operatorHelper2") || "") || undefined,
            location: String(fd.get("location") || "") || undefined,
            containerP: fd.get("containerP") ? Number(fd.get("containerP")) : undefined,
            containerL: fd.get("containerL") ? Number(fd.get("containerL")) : undefined,
            containerT: fd.get("containerT") ? Number(fd.get("containerT")) : undefined,
        };

        if (!body.initialDose || Number.isNaN(body.initialDose)) {
            formMsg.textContent = "Takaran gas wajib dipilih.";
            formMsg.className = "fw-form-msg is-error";
            return;
        }
        if (!body.durationHours || Number.isNaN(body.durationHours)) {
            formMsg.textContent = "Durasi fumigasi wajib dipilih.";
            formMsg.className = "fw-form-msg is-error";
            return;
        }

        try {
            const res = await fetch(`${apiBase}/api/sessions/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...NGROK_HEADERS },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            formMsg.textContent = "Sesi berhasil dimulai.";
            formMsg.className = "fw-form-msg is-ok";
            form.reset();
            recomputeVolumeAndGas();
            await refreshList();
        } catch (err) {
            formMsg.textContent = "Gagal memulai sesi. Cek koneksi ke server.";
            formMsg.className = "fw-form-msg is-error";
            console.error(err);
        }
    });

    refreshList();
}

function escapeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
