package com.axesistemas.axedespacho;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Pure Java, offline security validator for a future Android App Link
 * authorization-code callback (RFC 7636 + RFC 9207).
 *
 * No Activity, Intent filter, browser launch, network call or token exchange
 * invokes this class today. In particular, a valid callback MUST NOT be
 * interpreted as authorization to access Dispatch.
 */
final class AxeNativeCallbackGuard {
    static final long MAX_ATTEMPT_LIFETIME_MS = 5 * 60_000L;
    private static final int MAX_CALLBACK_CHARS = 4096;
    private static final Pattern STATE = Pattern.compile("^[A-Za-z0-9_-]{32,128}$");
    private static final Pattern CODE = Pattern.compile("^[A-Za-z0-9._~-]{32,256}$");
    private static final Pattern HOST = Pattern.compile("^[a-z0-9]+(?:[.-][a-z0-9]+)*$");
    private static final Pattern PATH = Pattern.compile("^/[A-Za-z0-9/_-]+$");

    private AxeNativeCallbackGuard() {}

    /**
     * A one-shot pending request. consume() invalidates the state BEFORE URL
     * validation, even for malformed or failed callbacks. This also prevents
     * two competing callbacks from redeeming the same local state.
     *
     * It is deliberately ephemeral: never serialize it to localStorage,
     * SharedPreferences, Activity saved state or WebView JavaScript.
     */
    static final class PendingAttempt {
        private String expectedState;
        private final long issuedAtMs;
        private final long expiresAtMs;
        private boolean consumed;

        PendingAttempt(String state, long issuedAtMs, long expiresAtMs) {
            if (state == null || !STATE.matcher(state).matches() ||
                issuedAtMs <= 0L || expiresAtMs <= issuedAtMs ||
                expiresAtMs - issuedAtMs > MAX_ATTEMPT_LIFETIME_MS) {
                throw new IllegalArgumentException("Tentativa OAuth nativa inválida.");
            }
            this.expectedState = state;
            this.issuedAtMs = issuedAtMs;
            this.expiresAtMs = expiresAtMs;
        }

        private synchronized String consume(long now) {
            if (consumed) throw invalid();
            consumed = true;
            String state = expectedState;
            expectedState = null;
            if (now < issuedAtMs || now >= expiresAtMs) throw invalid();
            return state;
        }

        synchronized boolean isConsumed() {
            return consumed;
        }
    }

    static String validateAndConsume(
        String callbackUri,
        String registeredRedirect,
        String registeredIssuer,
        PendingAttempt pending,
        long now
    ) {
        if (pending == null) throw invalid();
        // Fail closed and burn pending state on ANY callback attempt.
        String state = pending.consume(now);
        try {
            if (callbackUri == null || callbackUri.length() > MAX_CALLBACK_CHARS ||
                callbackUri.indexOf('\n') != -1 || callbackUri.indexOf('\r') != -1) throw invalid();
            URI redirect = strictEndpoint(registeredRedirect, false);
            strictEndpoint(registeredIssuer, true);

            URI callback = new URI(callbackUri);
            if (!"https".equals(callback.getScheme()) ||
                callback.getRawFragment() != null || callback.getUserInfo() != null ||
                callback.getPort() != -1 || callback.getRawQuery() == null ||
                callback.getRawQuery().length() == 0 ||
                // Exact string comparison prevents path/host normalization,
                // alternate ports and double-encoded redirect confusion.
                !callbackUri.startsWith(registeredRedirect + "?") ||
                !registeredRedirect.equals(
                    callbackUri.substring(0, callbackUri.indexOf('?')))) throw invalid();
            if (!redirect.getHost().equals(callback.getHost()) ||
                !redirect.getRawPath().equals(callback.getRawPath())) throw invalid();

            String[] pairs = callback.getRawQuery().split("&", -1);
            if (pairs.length != 3) throw invalid();
            Map<String,String> params = new HashMap<>();
            for (String pair : pairs) {
                int equalSign = pair.indexOf('=');
                if (equalSign <= 0 || pair.indexOf('=', equalSign + 1) >= 0) throw invalid();
                String name = pair.substring(0, equalSign);
                if (!("code".equals(name) || "state".equals(name) || "iss".equals(name)))
                    throw invalid();
                String rawValue = pair.substring(equalSign + 1);
                if (rawValue.isEmpty() || rawValue.indexOf('+') >= 0) throw invalid();
                String decoded = URLDecoder.decode(rawValue, StandardCharsets.UTF_8);
                if (!isAsciiPrintable(decoded) || params.putIfAbsent(name, decoded) != null)
                    throw invalid();
            }
            String code = params.get("code");
            String callbackState = params.get("state");
            String issuer = params.get("iss");
            if (code == null || callbackState == null || issuer == null ||
                !CODE.matcher(code).matches() || !STATE.matcher(callbackState).matches() ||
                !constantTimeAsciiEquals(state, callbackState) ||
                !constantTimeAsciiEquals(registeredIssuer, issuer)) throw invalid();

            // The code stays in the native caller only. The current app does
            // not invoke this validator and does not have a token endpoint.
            return code;
        } catch (Exception e) {
            throw invalid();
        }
    }

    private static URI strictEndpoint(String source, boolean issuer) throws Exception {
        if (source == null || source.length() > 512) throw invalid();
        URI uri = new URI(source);
        String hostname = uri.getHost();
        if (!"https".equals(uri.getScheme()) || hostname == null ||
            !HOST.matcher(hostname).matches() || !hostname.contains(".") ||
            hostname.startsWith("127.") || hostname.equals("localhost") ||
            uri.getUserInfo() != null || uri.getPort() != -1 ||
            uri.getRawQuery() != null || uri.getRawFragment() != null ||
            !hostname.equals(uri.getRawAuthority())) throw invalid();
        if (issuer) {
            if (uri.getRawPath() != null && !uri.getRawPath().isEmpty() &&
                !"/".equals(uri.getRawPath())) throw invalid();
        } else {
            String path = uri.getRawPath();
            if (path == null || !PATH.matcher(path).matches() ||
                path.contains("//") || path.contains("/./") || path.contains("/../"))
                throw invalid();
        }
        if (!source.equals(uri.toASCIIString())) throw invalid();
        return uri;
    }

    private static boolean constantTimeAsciiEquals(String left, String right) {
        if (left == null || right == null || !isAsciiPrintable(left) || !isAsciiPrintable(right))
            return false;
        return MessageDigest.isEqual(
            left.getBytes(StandardCharsets.US_ASCII),
            right.getBytes(StandardCharsets.US_ASCII));
    }

    private static boolean isAsciiPrintable(String text) {
        if (text == null) return false;
        for (int i=0;i<text.length();i++) {
            if (text.charAt(i) < 0x21 || text.charAt(i) > 0x7e) return false;
        }
        return true;
    }

    private static IllegalArgumentException invalid() {
        // Do not echo callback URI, code, state or issuer in exceptions/logs.
        return new IllegalArgumentException("Retorno de autorização móvel inválido ou já consumido.");
    }
}
