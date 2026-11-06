import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Runs the actual pure Java callback validator against adversarial callbacks
 * under JDK 21. No Android SDK, backend or internet access is required.
 */
const root=process.cwd();
const code=resolve(root,"native/android/AxeNativeCallbackGuard.java");
const harness=resolve(root,"native/android/testing/AxeNativeCallbackGuardHarness.java");
if(!existsSync(code)||!existsSync(harness))throw Error("Java callback validator or harness missing.");

const tmp=mkdtempSync(join(tmpdir(),"axe-callback-security-"));
try {
  const javac=spawnSync("javac",["-encoding","UTF-8","-d",tmp,code,harness],{
    stdio:"inherit",shell:false,timeout:30_000,
  });
  if(javac.error || javac.status!==0)throw Error("Compilação Java do contrato callback falhou.");
  const java=spawnSync("java",["-cp",tmp,"com.axesistemas.axedespacho.AxeNativeCallbackGuardHarness"],{
    stdio:"inherit",shell:false,timeout:30_000,
  });
  if(java.error || java.status!==0)throw Error("Validação Java do callback OAuth falhou.");
} finally {
  rmSync(tmp,{recursive:true,force:true});
}
