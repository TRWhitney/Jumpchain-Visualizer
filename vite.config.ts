import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const tauriHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    host: tauriHost ?? "127.0.0.1",
    port: 1420,
    strictPort: true,
    hmr: tauriHost
      ? {
          protocol: "ws",
          host: tauriHost,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**", "**/crates/**"],
    },
  },
});
