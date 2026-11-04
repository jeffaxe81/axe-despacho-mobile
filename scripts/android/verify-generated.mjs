import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function check(ok, message) {
  if (!ok) throw new Error(message);
}
const root = process.cwd();
const config = readFileSync(resolve(root, "capacitor.config.ts"), "utf8");
check(/appId:\s*["']com\.axesistemas\.axedespacho["']/.test(config), "ID Android inesperado.");
check(!/server:\s*\{/.test(config), "Capacitor server.url/cleartext não permitido na fase Android.");
const manifestPath = resolve(root, "android/app/src/main/AndroidManifest.xml");
check(existsSync(manifestPath), "Projeto Android não criado. Rode npx cap add android.");
const manifest = readFileSync(manifestPath, "utf8");
check(/<application\b/.test(manifest), "AndroidManifest sem application.");
check(!/usesCleartextTraffic\s*=\s*["']true["']/.test(manifest), "Tráfego HTTP liberado indevidamente.");
check(!/ACCESS_BACKGROUND_LOCATION/.test(manifest), "Permissão GPS background antecipada sem serviço homologado.");
check(!/android:foregroundServiceType\s*=/.test(manifest), "ForegroundService não homologado nesta fase.");
const apkConfig = resolve(root, "android/app/build.gradle");
check(existsSync(apkConfig), "Projeto Gradle Android não encontrado.");
const build = readFileSync(apkConfig, "utf8");
check(build.includes("com.axesistemas.axedespacho"), "ID do pacote nativo não coincide com AXE Despacho.");
console.log("Android debug: IDs consistentes; sem cleartext, acesso background ou serviço não homologado.");
