import { describe,expect,it } from "vitest";
import { injectLocationLabManifest, generatedMainActivity } from "./install-location-lab.mjs";

const manifest = `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application android:allowBackup="false"></application>
</manifest>`;

describe("instalação do GPS nativo de laboratório",()=>{
  it("insere o serviço de localização e as permissões exatas sem ACCESS_BACKGROUND_LOCATION",()=>{
    const result=injectLocationLabManifest(manifest);
    expect(result).toContain('android:foregroundServiceType="location"');
    expect(result).toContain('android:exported="false"');
    expect(result).toContain("android.permission.FOREGROUND_SERVICE_LOCATION");
    expect(result).not.toContain("ACCESS_BACKGROUND_LOCATION");
    expect(injectLocationLabManifest(result)).toBe(result);
  });
  it("não aceita XML divergente ou permissões background não homologadas",()=>{
    expect(()=>injectLocationLabManifest("<manifest/>")).toThrow();
    expect(()=>injectLocationLabManifest(manifest.replace("<application","<uses-permission android:name=\"android.permission.ACCESS_BACKGROUND_LOCATION\"/><application"))).toThrow();
  });
  it("registra o plugin no MainActivity gerado",()=>{
    expect(generatedMainActivity()).toContain("registerPlugin(AxeLocationLabPlugin.class)");
  });
});
