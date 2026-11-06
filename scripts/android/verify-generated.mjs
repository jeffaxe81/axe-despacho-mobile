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
check(/<application\b[^>]*android:allowBackup\s*=\s*["']false["']/.test(manifest), "Backup Android deve permanecer desabilitado para o cofre nativo.");
check(!/usesCleartextTraffic\s*=\s*["']true["']/.test(manifest), "Tráfego HTTP liberado indevidamente.");
check(!/ACCESS_BACKGROUND_LOCATION/.test(manifest), "Permissão GPS background antecipada sem serviço homologado.");
check(/android:foregroundServiceType\s*=\s*["']location["']/.test(manifest), "GPS laboratório sem foregroundServiceType location.");
check(/android:name\s*=\s*["']\.AxeLocationLabService["']/.test(manifest), "Serviço nativo GPS laboratório ausente.");
check(/android:exported\s*=\s*["']false["']/.test(manifest), "Serviço não exportado obrigatório.");
check(/android\.permission\.FOREGROUND_SERVICE_LOCATION/.test(manifest), "Permissão FGS location ausente.");
const javaPath = resolve(root,"android/app/src/main/java/com/axesistemas/axedespacho");
check(existsSync(resolve(javaPath,"AxeLocationLabService.java")), "Serviço Java laboratório ausente.");
check(existsSync(resolve(javaPath,"AxeLocationLabPlugin.java")), "Plugin Java laboratório ausente.");
for (const nativeClass of ["AxeNativeAuthPolicy.java", "AxeNativeSessionVault.java", "AxeNativeAuthLabPlugin.java", "AxeNativeCallbackGuard.java"]) {
  check(existsSync(resolve(javaPath,nativeClass)), "Classe nativa de autenticação laboratório ausente: "+nativeClass);
}
const nativeAuthPolicy=readFileSync(resolve(javaPath,"AxeNativeAuthPolicy.java"),"utf8");
check(/OPERATIONAL_LOGIN_ENABLED\s*=\s*false\s*;/.test(nativeAuthPolicy), "Login Android não pode ser ativado neste ciclo.");
const callbackGuard=readFileSync(resolve(javaPath,"AxeNativeCallbackGuard.java"),"utf8");
check(callbackGuard.includes("validateAndConsume("), "Validação nativa do callback OAuth ausente.");
check(callbackGuard.includes("PendingAttempt"), "Proteção antirreplay nativa ausente.");
const nativeLab=readFileSync(resolve(javaPath,"AxeNativeAuthLabPlugin.java"),"utf8");
check(/@CapacitorPlugin\(name\s*=\s*"AxeNativeAuthLab"\)/.test(nativeLab), "Nome do plugin PKCE divergente.");
check(!/response\.put\(\s*"(?:verifier|codeVerifier|token|accessToken|refreshToken|sessionHandle|secret)"/i.test(nativeLab), "PKCE e segredos não podem ser exportados à WebView.");
check(!/ACTION_VIEW|startActivity|https?:\/\//.test(nativeLab), "PKCE LAB não pode abrir URL externa ou navegar fora da WebView.");
check(readFileSync(resolve(javaPath,"MainActivity.java"),"utf8").includes("registerPlugin(AxeLocationLabPlugin.class)"), "Plugin não registrado na Activity.");
check(readFileSync(resolve(javaPath,"MainActivity.java"),"utf8").includes("registerPlugin(AxeNativeAuthLabPlugin.class)"), "Plugin PKCE não registrado na Activity.");
check(!/android:scheme=["']https["']/.test(manifest), "App Link Android não aprovado: domínio oficial e assetlinks.json ainda pendentes.");
check(!/android:autoVerify=["']true["']/.test(manifest), "Verificação App Links não autorizada sem domínio e associação aprovados.");
const apkConfig = resolve(root, "android/app/build.gradle");
check(existsSync(apkConfig), "Projeto Gradle Android não encontrado.");
const build = readFileSync(apkConfig, "utf8");
check(build.includes("com.axesistemas.axedespacho"), "ID do pacote nativo não coincide com AXE Despacho.");
console.log("Android debug: GPS/PKCE apenas laboratório; login nativo e App Links bloqueados; nenhum segredo exportado.");
