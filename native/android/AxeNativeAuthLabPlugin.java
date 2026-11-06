package com.axesistemas.axedespacho;

import android.app.Activity;
import android.content.pm.ApplicationInfo;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;

/**
 * Debug-only offline PKCE demonstrator. NO LOGIN, CALLBACK, TOKEN EXCHANGE,
 * AUTHORIZATION, NETWORK CALL OR APP LINK IS ENABLED.
 *
 * The PKCE verifier is a private ephemeral native byte array; it is never
 * returned to WebView JavaScript or stored in WebView storage.
 */
@CapacitorPlugin(name = "AxeNativeAuthLab")
public final class AxeNativeAuthLabPlugin extends Plugin {
    private static final int ENTROPY_BYTES = 32;
    private static final long LAB_TTL_MS = 5 * 60 * 1000L;
    private static final int BASE64_FLAGS = Base64.NO_WRAP | Base64.NO_PADDING | Base64.URL_SAFE;
    private byte[] pendingVerifier;
    private long pendingUntil;

    private boolean debugApp() {
        return (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private synchronized void erasePending() {
        if (pendingVerifier != null) Arrays.fill(pendingVerifier, (byte) 0);
        pendingVerifier = null;
        pendingUntil = 0L;
    }

    private static String randomBase64Url() {
        byte[] random = new byte[ENTROPY_BYTES];
        new SecureRandom().nextBytes(random);
        try {
            return Base64.encodeToString(random, BASE64_FLAGS);
        } finally {
            Arrays.fill(random, (byte) 0);
        }
    }

    @PluginMethod
    public synchronized void prepareLab(PluginCall call) {
        // The offline lab must never run in a release APK or start when
        // Android is backgrounded/has no visible foreground Activity.
        if (!debugApp()) {
            call.reject("PKCE laboratório disponível somente em APK debug.");
            return;
        }
        Activity activity=getActivity();
        if (activity == null || activity.isFinishing() || !activity.hasWindowFocus()) {
            call.reject("Abra o aplicativo para preparar o PKCE de laboratório.");
            return;
        }
        erasePending();
        try {
            String verifier = randomBase64Url();
            pendingVerifier = verifier.getBytes(StandardCharsets.US_ASCII);
            String challenge = Base64.encodeToString(
                MessageDigest.getInstance("SHA-256").digest(pendingVerifier),
                BASE64_FLAGS);
            String state = randomBase64Url();
            pendingUntil = System.currentTimeMillis() + LAB_TTL_MS;
            JSObject response = new JSObject();
            response.put("mode", "offline-lab");
            response.put("codeChallengeMethod", "S256");
            response.put("codeChallenge", challenge);
            response.put("state", state);
            response.put("expiresAtMs", pendingUntil);
            response.put("nativeLoginEnabled", false);
            // The verifier remains only in memory. It cannot be recovered
            // through this Plugin. No remote endpoint is contacted.
            call.resolve(response);
        } catch (Exception ignored) {
            erasePending();
            call.reject("Não foi possível preparar o PKCE de laboratório.");
        }
    }

    @PluginMethod
    public synchronized void status(PluginCall call) {
        if (pendingVerifier != null && System.currentTimeMillis() >= pendingUntil)
            erasePending();
        JSObject result=new JSObject();
        result.put("nativeLoginEnabled", AxeNativeAuthPolicy.isOperationalLoginReady());
        result.put("authorizationEndpointEnabled", false);
        result.put("tokenExchangeEnabled", false);
        result.put("labOnly", true);
        result.put("hasPendingLabChallenge", debugApp() && pendingVerifier != null);
        result.put("hasEncryptedVaultData", AxeNativeSessionVault.hasEncryptedData(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public synchronized void clearLab(PluginCall call) {
        erasePending();
        AxeNativeSessionVault.clear(getContext());
        JSObject result=new JSObject();
        result.put("cleared", true);
        result.put("nativeLoginEnabled", false);
        call.resolve(result);
    }

    @Override
    protected void handleOnDestroy() {
        erasePending();
        super.handleOnDestroy();
    }
}
