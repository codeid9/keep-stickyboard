import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/keep-stickyboard/" : "/",
  plugins: [react()],
  server: { port: 5173, strictPort: true },
}));