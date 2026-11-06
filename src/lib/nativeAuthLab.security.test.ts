import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertNativeApiAuthenticationReady } from "./api";


function native(name:string):string {
  return readFileSync(resolve(process.cwd(),"native/android",name),"utf8");
}

describe("Android native auth offline lab safety contract",()=>{
  const java=native("AxeNativeAuthLabPlugin.java");
  const policy=native("AxeNativeAuthPolicy.java");
  const vault=native("AxeNativeSessionVault.java");
  const androidInstaller=readFileSync(resolve(process.cwd(),"scripts/android/install-location-lab.mjs"),"utf8");
  const generatedChecks=readFileSync(resolve(process.cwd(),"scripts/android/verify-generated.mjs"),"utf8");
  const webClient=readFileSync(resolve(process.cwd(),"src/lib/api.ts"),"utf8");

  it("keeps ALL Android authenticated API calls fail-closed",()=>{
    expect(()=>assertNativeApiAuthenticationReady(true)).toThrowError(/nativo/);
    expect(()=>assertNativeApiAuthenticationReady(false)).not.toThrow();
    expect(webClient).toContain("NATIVE_AUTH_PENDING");
  });
  it("hard-disables native login without an officially verified App Link",()=>{
    expect(policy).toMatch(/OPERATIONAL_LOGIN_ENABLED\s*=\s*false\s*;/);
    expect(policy).toMatch(/REGISTERED_CLIENT_ID\s*=\s*""/);
    expect(policy).toMatch(/REGISTERED_ISSUER\s*=\s*""/);
    expect(policy).toMatch(/VERIFIED_APP_LINK\s*=\s*""/);
    expect(policy).not.toMatch(/https:\/\/[A-Za-z0-9.-]+/);
  });
  it("generates unpredictable native verifier/state and PKCE S256",()=>{
    expect(java).toContain("new SecureRandom().nextBytes(random)");
    expect(java).toContain('MessageDigest.getInstance("SHA-256")');
    expect(java).toContain("Base64.URL_SAFE");
    expect(java).toContain("Base64.NO_PADDING");
    expect(java).toContain("ENTROPY_BYTES = 32");
    expect(java).toContain("LAB_TTL_MS = 5 * 60 * 1000L");
  });
  it("never returns PKCE verifier, session handles, tokens or passwords to WebView",()=>{
    expect(java).not.toMatch(/response\.put\(\s*"(?:verifier|codeVerifier|token|accessToken|refreshToken|secret|password|handle)"/i);
    expect(java).not.toMatch(/call\.getString\(\s*"(?:token|refreshToken|password|verifier|codeVerifier|handle|secret)"/i);
    expect(java).toContain("private byte[] pendingVerifier;");
    expect(java).toContain("Arrays.fill(pendingVerifier, (byte) 0)");
    expect(java).not.toContain("addJavascriptInterface");
  });
  it("contains no network, token exchange, browser redirects or deep-link handlers",()=>{
    expect(java).not.toMatch(/HttpURLConnection|OkHttpClient|ACTION_VIEW|startActivity|shouldOverrideUrlLoading|Intent\.parseUri/);
    expect(java).not.toContain("Authorization: Bearer");
    expect(java).not.toContain("setJavaScriptEnabled");
    expect(java).not.toContain("getCookieManager");
  });
  it("exposes only status, clear and debug-only offline challenge methods",()=>{
    const publicPluginMethods=[...java.matchAll(/@PluginMethod\s+public\s+(?:synchronized\s+)?void\s+(\w+)\(/g)].map(match=>match[1]);
    expect(publicPluginMethods.sort()).toEqual(["clearLab","prepareLab","status"]);
    expect(java).toContain("if (!debugApp())");
    expect(java).toContain("activity.hasWindowFocus()");
    expect(java).toContain("handleOnDestroy()");
  });
  it("never writes a plaintext credential to SharedPreferences or WebView",()=>{
    expect(vault).toContain('KeyStore.getInstance(KEYSTORE)');
    expect(vault).toContain('KEYSTORE = "AndroidKeyStore"');
    expect(vault).toContain("KeyProperties.KEY_ALGORITHM_AES");
    expect(vault).toContain("KeyProperties.BLOCK_MODE_GCM");
    expect(vault).toContain("new GCMParameterSpec(GCM_TAG_BITS, iv)");
    expect(vault).toContain("cipher.doFinal(copy)");
    expect(vault).toContain(".putString(CIPHER_KEY, Base64.encodeToString(encrypted, Base64.NO_WRAP))");
    expect(vault).not.toMatch(/^\s*@PluginMethod\b/m);
    expect(vault).not.toContain("public class");
    expect(vault).toContain("Arrays.fill(copy, (byte) 0)");
  });
  it("deletes ciphertext and Android Keystore key on local clear",()=>{
    expect(vault).toContain("preferences(context).edit().clear().commit()");
    expect(vault).toContain("store.deleteEntry(KEY_ALIAS)");
    expect(java).toContain("AxeNativeSessionVault.clear(getContext())");
  });
  it("installs and registers both GPS and PKCE plugins",()=>{
    const activity=androidInstaller;
    expect(activity).toContain("registerPlugin(AxeLocationLabPlugin.class)");
    expect(activity).toContain("registerPlugin(AxeNativeAuthLabPlugin.class)");
    for(const file of ["AxeNativeAuthPolicy.java","AxeNativeSessionVault.java","AxeNativeAuthLabPlugin.java"]){
      expect(androidInstaller).toContain(file);
    }
  });
  it("rejects accidental operational native login and unverified App Links in APK",()=>{
    expect(generatedChecks).toContain("OPERATIONAL_LOGIN_ENABLED");
    expect(generatedChecks).toContain("android:autoVerify");
    expect(generatedChecks).toContain("android:scheme");
    expect(generatedChecks).toContain("response");
    expect(generatedChecks).toContain("AxeNativeAuthLabPlugin.class");
  });
  it("has no native operational permissions or background GPS upload changes",()=>{
    const manifestInstaller=androidInstaller;
    expect(manifestInstaller).toContain("Não adicionar permissão GPS background");
    expect(manifestInstaller).not.toContain("android.permission.INTERNET");
    expect(java).not.toContain("recordLocation");
    expect(java).not.toContain("sendLocation");
  });
});
