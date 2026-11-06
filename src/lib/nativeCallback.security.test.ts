import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertNativeApiAuthenticationReady } from "./api";

function file(path:string):string {
  return readFileSync(resolve(process.cwd(),path),"utf8");
}

describe("native OAuth callback bridge remains offline and fail-closed",()=>{
  const validator=file("native/android/AxeNativeCallbackGuard.java");
  const harness=file("native/android/testing/AxeNativeCallbackGuardHarness.java");
  const installer=file("scripts/android/install-location-lab.mjs");
  const verify=file("scripts/android/verify-generated.mjs");
  const workflow=file(".github/workflows/android-debug.yml");
  const policy=file("native/android/AxeNativeAuthPolicy.java");
  const lab=file("native/android/AxeNativeAuthLabPlugin.java");
  const main=file("src/App.tsx");

  it("never unlocks authenticated Android API methods",()=>{
    expect(()=>assertNativeApiAuthenticationReady(true)).toThrow();
    expect(policy).toMatch(/OPERATIONAL_LOGIN_ENABLED\s*=\s*false\s*;/);
  });
  it("allows no exported Activity deep-link handler or unverified App Link",()=>{
    const activity=installer.slice(installer.indexOf("export function generatedMainActivity"));
    expect(activity).not.toMatch(/onNewIntent|ACTION_VIEW|handleAuthorizationCode|startActivity/);
    expect(installer).not.toContain("android:autoVerify");
    expect(verify).toContain("android:autoVerify");
    expect(verify).toContain("App Link");
    expect(lab).not.toMatch(/onNewIntent|startActivity|ACTION_VIEW|requestPermissions/);
  });
  it("includes the actual pure Java callback guard in the Android package",()=>{
    expect(installer).toContain('"AxeNativeCallbackGuard.java"');
    expect(verify).toContain('AxeNativeCallbackGuard.java');
    expect(validator).toContain("static String validateAndConsume(");
    expect(validator).not.toContain("@PluginMethod");
    expect(validator).not.toContain("public class");
  });
  it("strictly validates issuer and state and burns state before any callback check",()=>{
    expect(validator).toContain('String state = pending.consume(now)');
    expect(validator).toContain('!"https".equals(callback.getScheme())');
    expect(validator).toContain('callback.getRawFragment() != null');
    expect(validator).toContain('callback.getPort() != -1');
    expect(validator).toContain('!constantTimeAsciiEquals(state, callbackState)');
    expect(validator).toContain('!constantTimeAsciiEquals(registeredIssuer, issuer)');
  });
  it("rejects unknown or duplicate callback parameters and overly long URLs",()=>{
    expect(validator).toContain("MAX_CALLBACK_CHARS = 4096");
    expect(validator).toContain("if (pairs.length != 3)");
    expect(validator).toContain('params.putIfAbsent(name, decoded)');
    expect(validator).toContain('rawValue.indexOf(\'+\') >= 0');
    expect(validator).toContain("MAX_ATTEMPT_LIFETIME_MS = 5 * 60_000L");
  });
  it("tests Java code in JDK 21, including 32-thread replay contention",()=>{
    expect(workflow).toContain("node scripts/android/test-native-callback.mjs");
    expect(harness).toContain("final int workers=32");
    expect(harness).toContain("CountDownLatch");
    expect(harness).toContain("accepted.get()==1");
    expect(harness).toContain("denied.get()==workers-1");
  });
  it("keeps native verifier and authorization code out of WebView responses",()=>{
    expect(lab).not.toMatch(/response\.put\(\s*"(?:code|verifier|codeVerifier|token|handle|refreshToken)"/i);
    expect(validator).not.toContain("JSObject");
    expect(validator).not.toContain("PluginCall");
    expect(main).toContain("NATIVE_AUTH_PENDING");
  });
  it("marks encrypted native session data as excluded from APK backup",()=>{
    expect(installer).toContain('android:allowBackup="false"');
    expect(verify).toContain("allowBackup");
  });
});
