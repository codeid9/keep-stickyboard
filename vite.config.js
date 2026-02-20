import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  return {
    base: mode === "production" 
      ? "/keep-stickyboard/" 
      : "./",
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
    },
  };
});