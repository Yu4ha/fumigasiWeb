import { defineConfig } from "vite";

// Proxy /api dan /ws ke relay server (ngrok) supaya browser cukup ngomong
// ke localhost sendiri (same-origin) -> tidak ada CORS preflight, dan
// tidak ada masalah resolusi IPv6 di sisi browser. Vite (Node.js) yang
// urus koneksi keluar ke ngrok di belakang layar.
//
// Ganti target di bawah kalau URL ngrok berubah (tiap kali ngrok direstart
// tanpa domain reserved, URL-nya bisa beda).
// PENTING: pakai http:// (bukan https://) karena tunnel dijalankan dengan
// flag --scheme=http (lihat catatan setup ngrok project ini).
const RELAY_TARGET = "http://crispy-unshipped-unmasking.ngrok-free.dev";

export default defineConfig({
  server: {
    port: 5177,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: RELAY_TARGET,
        changeOrigin: true,
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      },
      "/ws": {
        target: RELAY_TARGET.replace(/^http/, "ws"),
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
