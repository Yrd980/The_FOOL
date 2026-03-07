import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:4174",
      "/health": "http://localhost:4174"
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
