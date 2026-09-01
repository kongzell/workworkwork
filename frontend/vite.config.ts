import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ใน docker จะชี้ proxy ไปที่ service `api` และเปิด polling (bind mount บน Windows)
const proxyTarget = process.env.VITE_PROXY_TARGET ?? "http://localhost:3000";
const usePolling = process.env.VITE_POLLING === "true";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      "/api": proxyTarget,
    },
  },
});
