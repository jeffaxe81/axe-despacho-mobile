import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.axesistemas.axedespacho",
  appName: "AXE Despacho",
  webDir: "dist",
  // Never set server.url for production or embed the central in an insecure WebView.
  // The current server cookie session is same-origin only. Native auth integration
  // MUST be approved and implemented in the central before enabling field writes.
  plugins: {
    SplashScreen: { launchShowDuration: 0 },
  },
};

export default config;
