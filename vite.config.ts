import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { validateDevelopmentProxyTarget } from "./src/lib/devProxySafety";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const proxyTarget = env.VITE_DISPATCH_DEV_PROXY
    ? validateDevelopmentProxyTarget(env.VITE_DISPATCH_DEV_PROXY)
    : null;
  const proxy = proxyTarget
    ? { "/api": { target: proxyTarget, changeOrigin: true, secure: true } }
    : undefined;
  return {
    plugins: [react()],
    // The dev server must not expose a cookie-auth proxy to phones/LAN devices.
    server: { host: "127.0.0.1", port: 5175, strictPort: true, proxy },
    test: { environment: "node" },
  };
});
