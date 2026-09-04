import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "src/renderer",
  base: "./",
  plugins: [react()],
  // Explicit empty inline postcss config: without this, Vite's config
  // loader walks up the directory tree and picks up the parent CheapStays
  // web app's postcss.config.js (Tailwind), which isn't installed here and
  // isn't needed — this app ships plain CSS only.
  css: {
    postcss: { plugins: [] },
  },
  server: {
    port: 5183,
    strictPort: true,
  },
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
  },
});
