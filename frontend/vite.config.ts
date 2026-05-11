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
});
