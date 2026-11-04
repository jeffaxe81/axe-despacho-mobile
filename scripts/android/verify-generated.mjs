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
check(/android:foregroundServiceType\s*=\s*["']location["']/.test(manifest), "GPS laboratório sem foregroundServiceType location.");
check(/android:name\s*=\s*["']\.AxeLocationLabService["']/.test(manifest), "Serviço nativo GPS laboratório ausente.");
check(/android:exported\s*=\s*["']false["']/.test(manifest), "Serviço não exportado obrigatório.");
check(/android\.permission\.FOREGROUND_SERVICE_LOCATION/.test(manifest), "Permissão FGS location ausente.");
const javaPath = resolve(root,"android/app/src/main/java/com/axesistemas/axedespacho");
check(existsSync(resolve(javaPath,"AxeLocationLabService.java")), "Serviço Java laboratório ausente.");
check(existsSync(resolve(javaPath,"AxeLocationLabPlugin.java")), "Plugin Java laboratório ausente.");
check(readFileSync(resolve(javaPath,"MainActivity.java"),"utf8").includes("registerPlugin(AxeLocationLabPlugin.class)"), "Plugin não registrado na Activity.");
const apkConfig = resolve(root, "android/app/build.gradle");
check(existsSync(apkConfig), "Projeto Gradle Android não encontrado.");
const build = readFileSync(apkConfig, "utf8");
check(build.includes("com.axesistemas.axedespacho"), "ID do pacote nativo não coincide com AXE Despacho.");
console.log("Android debug: IDs consistentes; serviço GPS apenas laboratório, sem cleartext e sem ACCESS_BACKGROUND_LOCATION.");
