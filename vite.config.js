import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/Video-Calling-App/",
  server: {
    host: true,
  },
});
