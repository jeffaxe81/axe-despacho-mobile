import { existsSync, mkdirSync, readFileSync, copyFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const SERVICE_DECLARATION = `    <service android:name=".AxeLocationLabService"
        android:exported="false"
        android:stopWithTask="false"
        android:foregroundServiceType="location" />`;

const REQUIRED_PERMISSIONS = [
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_LOCATION",
];

export function injectLocationLabManifest(manifest) {
  if (!manifest.includes("<manifest") || !manifest.includes("<application") || !manifest.includes("</application>")) {
    throw new Error("AndroidManifest não reconhecido; recusar modificação automática.");
  }
  if (manifest.includes("ACCESS_BACKGROUND_LOCATION")) {
    throw new Error("Não adicionar permissão GPS background sem homologação.");
  }
  if (!manifest.includes('xmlns:android="http://schemas.android.com/apk/res/android"')) {
    throw new Error("Namespace Android ausente.");
  }
  let output = manifest;
  for (const permission of REQUIRED_PERMISSIONS) {
    if (!output.includes(`android:name="${permission}"`)) {
      output = output.replace(/<application\b/, `<uses-permission android:name="${permission}" />\n    <application`);
    }
  }
  if (!output.includes('android:name=".AxeLocationLabService"')) {
    output = output.replace("</application>", `${SERVICE_DECLARATION}\n    </application>`);
  }
  return output;
}

export function generatedMainActivity() {
  return `package com.axesistemas.axedespacho;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AxeLocationLabPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`;
}

export function installLocationLab(root = process.cwd()) {
  const javaDir = resolve(root, "android/app/src/main/java/com/axesistemas/axedespacho");
  const manifestPath = resolve(root, "android/app/src/main/AndroidManifest.xml");
  const mainPath = resolve(javaDir, "MainActivity.java");
  if (!existsSync(mainPath) || !existsSync(manifestPath)) {
    throw new Error("Execute npx cap add android antes de instalar o laboratório GPS.");
  }
  const main = readFileSync(mainPath, "utf8");
  if (!main.includes("package com.axesistemas.axedespacho;") || !main.includes("extends BridgeActivity")) {
    throw new Error("MainActivity divergente. Revisão manual obrigatória.");
  }
  const manifest = readFileSync(manifestPath, "utf8");
  // Validate all generated changes before writing anything.
  const updatedManifest = injectLocationLabManifest(manifest);
  const updatedMain = generatedMainActivity();
  mkdirSync(javaDir, {recursive:true});
  for (const source of ["AxeLocationLabPlugin.java","AxeLocationLabService.java"]) {
    const from = resolve(root,"native/android",source);
    if (!existsSync(from)) throw new Error("Arquivo Java do laboratório ausente: "+source);
    copyFileSync(from,resolve(javaDir,source));
  }
  writeFileSync(mainPath,updatedMain);
  mkdirSync(dirname(manifestPath),{recursive:true});
  writeFileSync(manifestPath,updatedManifest);
  console.log("Plugin Android GPS LAB instalado no projeto gerado; sem rede e sem persistência de coordenadas.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  installLocationLab();
}
