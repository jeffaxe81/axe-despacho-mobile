package com.axesistemas.axedespacho;

import java.net.URI;

/**
 * HARD PRODUCTION GATE. No issuer, HTTPS App Link, client registration,
 * token endpoint or server/device attestation has been approved.
 *
 * A URL supplied by WebView JavaScript MUST NOT override these values.
 * Enable only through a separately audited native/backend release.
 */
final class AxeNativeAuthPolicy {
    static final boolean OPERATIONAL_LOGIN_ENABLED = false;
    static final String REGISTERED_CLIENT_ID = "";
    static final String REGISTERED_ISSUER = "";
    static final String VERIFIED_APP_LINK = "";

    private AxeNativeAuthPolicy() {}

    static boolean isOperationalLoginReady() {
        if (!OPERATIONAL_LOGIN_ENABLED) return false;
        try {
            URI issuer = new URI(REGISTERED_ISSUER);
            URI callback = new URI(VERIFIED_APP_LINK);
            return !REGISTERED_CLIENT_ID.isEmpty()
                    && "https".equals(issuer.getScheme())
                    && issuer.getHost() != null
                    && issuer.getUserInfo() == null
                    && issuer.getPort() == -1
                    && (issuer.getRawQuery() == null && issuer.getRawFragment() == null)
                    && "/".equals(issuer.getPath())
                    && "https".equals(callback.getScheme())
                    && callback.getHost() != null
                    && callback.getUserInfo() == null
                    && callback.getPort() == -1
                    && callback.getRawQuery() == null
                    && callback.getRawFragment() == null
                    && callback.getPath() != null && callback.getPath().length() > 1;
        } catch (Exception ignored) {
            return false;
        }
    }
}
