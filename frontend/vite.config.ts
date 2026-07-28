/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Native fs watchers often miss changes on Docker bind mounts (esp. Windows hosts).
      usePolling: process.env.CHOKIDAR_USEPOLLING === "true",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/hooks/**", "src/services/**"],
      reporter: ["text", "text-summary"],
    },
  },
});
