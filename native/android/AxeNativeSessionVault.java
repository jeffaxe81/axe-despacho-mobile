package com.axesistemas.axedespacho;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Native-only preparation for an eventual secure credential store.
 * No Capacitor @PluginMethod exposes read/write of credential material.
 * No operational session is created by the current APK.
 *
 * Only an audited trusted native token exchange may ever call the package-
 * private storeTrustedNativeOnly/readTrustedNativeOnly methods.
 */
final class AxeNativeSessionVault {
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "axe_despacho_native_session_v1";
    private static final String PREFS = "axe_despacho_native_session_cipher_v1";
    private static final String IV_KEY = "iv";
    private static final String CIPHER_KEY = "cipher";
    private static final int IV_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;

    private AxeNativeSessionVault() {}

    private static SharedPreferences preferences(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static SecretKey key(boolean create) throws Exception {
        KeyStore store = KeyStore.getInstance(KEYSTORE);
        store.load(null);
        KeyStore.Entry existing = store.getEntry(KEY_ALIAS, null);
        if (existing instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) existing).getSecretKey();
        }
        if (!create) throw new IllegalStateException("Chave do dispositivo não encontrada.");
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        generator.init(new KeyGenParameterSpec.Builder(
                KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return generator.generateKey();
    }

    /**
     * The input is strictly a trusted native result. Never accept a token
     * received via JavaScript, localStorage, a Capacitor call or a deep link.
     * Ciphertext is AES-256-GCM with an independent random IV per write.
     */
    static synchronized void storeTrustedNativeOnly(Context context, byte[] material) throws Exception {
        if (material == null || material.length == 0 || material.length > 8192)
            throw new IllegalArgumentException("Credencial nativa inválida.");
        byte[] copy = Arrays.copyOf(material, material.length);
        try {
            byte[] iv = new byte[IV_BYTES];
            new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(true), new GCMParameterSpec(GCM_TAG_BITS, iv));
            // AAD binds ciphertext to this app and to the vault protocol version.
            cipher.updateAAD("com.axesistemas.axedespacho:session:v1".getBytes(StandardCharsets.US_ASCII));
            byte[] encrypted = cipher.doFinal(copy);
            boolean persisted = preferences(context).edit()
                .putString(IV_KEY, Base64.encodeToString(iv, Base64.NO_WRAP))
                .putString(CIPHER_KEY, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .commit();
            Arrays.fill(encrypted, (byte) 0);
            if (!persisted) throw new IllegalStateException("Falha ao salvar sessão nativa.");
        } finally {
            Arrays.fill(copy, (byte) 0);
        }
    }

    /**
     * Returns plaintext bytes ONLY to trusted native code. Do not expose
     * this method or its return value from a Capacitor PluginMethod.
     */
    static synchronized byte[] readTrustedNativeOnly(Context context) throws Exception {
        SharedPreferences prefs = preferences(context);
        String ivEncoded = prefs.getString(IV_KEY, null);
        String encrypted = prefs.getString(CIPHER_KEY, null);
        if (ivEncoded == null || encrypted == null)
            throw new IllegalStateException("Nenhuma sessão nativa.");
        try {
            byte[] iv = Base64.decode(ivEncoded, Base64.NO_WRAP);
            if (iv.length != IV_BYTES) throw new IllegalStateException("IV inválido.");
            byte[] ciphertext = Base64.decode(encrypted, Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(false), new GCMParameterSpec(GCM_TAG_BITS, iv));
            cipher.updateAAD("com.axesistemas.axedespacho:session:v1".getBytes(StandardCharsets.US_ASCII));
            return cipher.doFinal(ciphertext);
        } catch (Exception invalid) {
            // If the key was invalidated or backup restored an unpaired
            // ciphertext, fail closed and destroy the unusable data.
            clear(context);
            throw new IllegalStateException("Sessão nativa não pôde ser validada.");
        }
    }

    /**
     * Status only means encrypted bytes exist; it is NOT proof of an active,
     * valid or authorized server session.
     */
    static boolean hasEncryptedData(Context context) {
        SharedPreferences prefs = preferences(context);
        return prefs.contains(IV_KEY) && prefs.contains(CIPHER_KEY);
    }

    static synchronized void clear(Context context) {
        preferences(context).edit().clear().commit();
        try {
            KeyStore store = KeyStore.getInstance(KEYSTORE);
            store.load(null);
            if (store.containsAlias(KEY_ALIAS)) store.deleteEntry(KEY_ALIAS);
        } catch (Exception ignored) {
            // Never resurrect local ciphertext after an invalidation.
        }
    }
}
