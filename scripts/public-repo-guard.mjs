import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Public GitHub repository: block obvious secrets, signing material and mobile
 * provisioning files. This is a baseline gate, not a substitute for secret scanning.
 */
export function isForbiddenTrackedPath(path) {
  const name = path.split("/").at(-1) ?? "";
  if (name === ".env" || (name.startsWith(".env.") && name !== ".env.example")) return true;
  if (["google-services.json", "GoogleService-Info.plist", "local.properties", "id_rsa", "id_ed25519"].includes(name)) return true;
  if (/\\.(?:jks|keystore|p12|p8|pem|der|key|mobileprovision|cer)$/i.test(name)) return true;
  if (/^android\\/app\\/build\\/outputs\\//.test(path)) return true;
  return false;
}
export function validateTrackedPaths(paths) {
  return paths.filter(isForbiddenTrackedPath);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const tracked = execFileSync("git", ["ls-files", "-z"], { encoding:"utf8" }).split("\0").filter(Boolean);
  const forbidden = validateTrackedPaths(tracked);
  if(forbidden.length){
    console.error("Arquivos não permitidos em um repositório público:\n" + forbidden.join("\n"));
    process.exitCode=1;
  } else console.log("Verificação pública: nenhum arquivo de assinatura/segredo rastreado por Git.");
}
