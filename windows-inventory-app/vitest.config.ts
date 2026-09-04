import { defineConfig } from "vitest/config";

export default defineConfig({
  // Explicit root + inline (empty) postcss config: without these, Vite's
  // config loader walks up the directory tree and picks up the parent
  // CheapStays web app's postcss.config.js (Tailwind), which isn't
  // installed in this subproject and isn't needed for these Node tests.
  root: __dirname,
  css: {
    postcss: { plugins: [] },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    testTimeout: 15000,
  },
});
