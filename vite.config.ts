import { defineConfig } from "vitest/config";
export default defineConfig({
  base: "./",
  test: { include: ["src/tests/**/*.test.ts"], maxWorkers: 2 },
  server: { host: "0.0.0.0", port: 5173, strictPort: true },
  preview: { host: "0.0.0.0", port: 4173, strictPort: true },
});
