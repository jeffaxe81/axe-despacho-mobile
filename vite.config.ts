import { defineConfig, loadEnv } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const proxy = env.VITE_DISPATCH_DEV_PROXY
    ? { "/api": { target: env.VITE_DISPATCH_DEV_PROXY, changeOrigin: true, secure: false } }
    : undefined;
  return {
    plugins: [react()],
    server: { port: 5175, strictPort: true, proxy },
    test: { environment: "node" },
  };
});
