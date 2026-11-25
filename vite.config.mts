import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: ".",
  build: { outDir: "web/dist", emptyOutDir: true },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": process.env.VITE_API_TARGET || "http://127.0.0.1:3001" },
  },
});
