import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(({mode}) => ({
  plugins: [react(), tailwindcss()],
  // Glaze's components read process.env.NODE_ENV for their development warnings.
  define: {'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development')},
  resolve: { tsconfigPaths: true },
  build: {
    rolldownOptions: {
      // Two windows: the board and the quick capture box.
      input: { main: "index.html", capture: "capture.html" },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
