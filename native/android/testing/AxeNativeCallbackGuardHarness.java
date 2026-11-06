package com.axesistemas.axedespacho;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Runs under ordinary JDK 21 in Android CI and directly executes the same
 * pure Java validator packaged into the APK. No network or fake app domain
 * needs to be registered for these synthetic callback tests.
 */
public final class AxeNativeCallbackGuardHarness {
    private static final long NOW = 1_800_000_000_000L;
    private static final String REDIRECT = "https://app.example.test/mobile/oauth/callback";
    private static final String ISSUER = "https://identity.example.test";
    private static final String STATE = "aBCDef123_4567890GHIjklMNOpqrSTUVWxyz0";
    private static final String CODE = "auth-code-123456789_abcdefghijklmnopqrstuvwxyz";
    private static int assertions = 0;

    private static AxeNativeCallbackGuard.PendingAttempt pending() {
        return new AxeNativeCallbackGuard.PendingAttempt(STATE, NOW-1000L, NOW+120_000L);
    }
    private static String callback() {
        return REDIRECT + "?code=" + CODE + "&state=" + STATE + "&iss=" +
            URLEncoder.encode(ISSUER, StandardCharsets.UTF_8);
    }
    private static String use(String uri, AxeNativeCallbackGuard.PendingAttempt attempt) {
        return AxeNativeCallbackGuard.validateAndConsume(uri, REDIRECT, ISSUER, attempt, NOW);
    }
    private static void ok(boolean value, String name) {
        assertions++;
        if (!value) throw new AssertionError(name);
    }
    private static void rejected(Runnable action, String name) {
        assertions++;
        try {
            action.run();
        } catch (IllegalArgumentException expected) {
            ok(!String.valueOf(expected.getMessage()).contains(CODE), name+" must not log code");
            return;
        }
        throw new AssertionError(name+": expected rejection");
    }
    private static void rejectCallback(String callback, String label) {
        AxeNativeCallbackGuard.PendingAttempt attempt = pending();
        rejected(()->use(callback, attempt),label);
        ok(attempt.isConsumed(),label+" must burn state");
        rejected(()->use(AxeNativeCallbackGuardHarness.callback(), attempt),
            label+" cannot reuse the pending state");
    }

    public static void main(String[] args) throws Exception {
        AxeNativeCallbackGuard.PendingAttempt success = pending();
        ok(CODE.equals(use(callback(),success)),"accept expected code/state/issuer");
        ok(success.isConsumed(),"success burns state");
        rejected(()->use(callback(),success),"replayed valid callback");

        // Parse strict raw query keys: encoded keys, duplicates, extras,
        // fragments, empty code and alternate authority are forbidden.
        String[] bad = {
            callback() + "&extra=1",
            callback() + "&code=" + CODE,
            callback() + "&state=" + STATE,
            callback() + "&iss=" + URLEncoder.encode(ISSUER,StandardCharsets.UTF_8),
            callback().replace("code=", "c%6Fde="),
            callback().replace("state=", "st%61te="),
            callback().replace("iss=", "i%73s="),
            callback().replace("code="+CODE,"code="),
            callback().replace(CODE,"too-short"),
            callback().replace("state="+STATE,"state="+"z".repeat(43)),
            callback().replace("iss="+URLEncoder.encode(ISSUER,StandardCharsets.UTF_8),
                "iss="+URLEncoder.encode("https://identity.attacker.test",StandardCharsets.UTF_8)),
            callback().replace("code="+CODE,"code=abc%GG"),
            callback().replace("code="+CODE,"code=abc%FF"),
            callback().replace("code="+CODE,"code=abc+def"),
            callback().replace("code="+CODE,"code="+CODE+"="),
            callback().replace("?code=", "?unexpected=1&code="),
            callback().replace("?code=", "??code="),
            callback() + "#fragment",
            callback().replace("https://app.example.test","http://app.example.test"),
            callback().replace("https://app.example.test","https://evil.example.test"),
            callback().replace("https://app.example.test","https://user@app.example.test"),
            callback().replace("https://app.example.test","https://app.example.test:443"),
            callback().replace("/mobile/oauth/callback","/mobile/oauth/other"),
            callback().replace("/mobile/oauth/callback","/mobile/oauth/%63allback"),
            callback().replace("/mobile/oauth/callback","/mobile/../mobile/oauth/callback"),
            callback().replace("https://app.example.test","https://APP.EXAMPLE.TEST"),
            callback().replace("?code=", "?code=xyz&code="),
            callback().replace("&iss=", "&iss=https%3A%2F%2Fidentity.example.test%2Fadmin&again="),
            callback().replace("&iss=", "&iss="),
            callback().replace("code="+CODE,"code="+("a".repeat(257))),
            callback().replace("code="+CODE,"code="+("a".repeat(31))),
            callback().replace("code="+CODE,"code=../../../etc/passwd"),
            callback().replace("code="+CODE,"code=%00"),
            callback().replace("code="+CODE,"code=%0A"),
            callback().replace("code="+CODE,"code=%F0%9F%8C%80"),
            callback().replace("code="+CODE,"code="+("a".repeat(4097))),
            callback().replace("code="+CODE,"code=abc\nxyz"),
        };
        for (int i=0;i<bad.length;i++) rejectCallback(bad[i],"invalid callback variant "+i);
        rejectCallback(null,"null callback");

        // Missing, invalid, expired or premature state must fail closed.
        rejected(()->new AxeNativeCallbackGuard.PendingAttempt("tiny",NOW,NOW+1000),
            "short state");
        rejected(()->new AxeNativeCallbackGuard.PendingAttempt(STATE,NOW,NOW-1),
            "negative lifetime");
        rejected(()->new AxeNativeCallbackGuard.PendingAttempt(STATE,NOW,NOW+301_000),
            "long-lived attempt");
        rejected(()->new AxeNativeCallbackGuard.PendingAttempt(STATE,0,NOW+1000),
            "invalid clock");
        AxeNativeCallbackGuard.PendingAttempt expired=pending();
        rejected(()->AxeNativeCallbackGuard.validateAndConsume(
            callback(),REDIRECT,ISSUER,expired,NOW+120_000),"expired");
        ok(expired.isConsumed(),"expired burns state");
        AxeNativeCallbackGuard.PendingAttempt premature=pending();
        rejected(()->AxeNativeCallbackGuard.validateAndConsume(
            callback(),REDIRECT,ISSUER,premature,NOW-5000),"clock rollback");
        ok(premature.isConsumed(),"clock rollback burns state");

        // An attacker-controlled issuer/redirect cannot take ownership of
        // the registered App Link or identity server.
        for (String badRedirect: new String[] {
            "http://app.example.test/mobile/oauth/callback",
            "https://localhost/mobile/oauth/callback",
            "https://app.example.test:8443/mobile/oauth/callback",
            "https://app.example.test/mobile/oauth/%63allback",
            "https://app.example.test/",
            "https://app.example.test/mobile/oauth/../callback",
            "https://x@app.example.test/mobile/oauth/callback",
            "https://app.example.test/mobile/oauth/callback?x=1",
        }) {
            AxeNativeCallbackGuard.PendingAttempt pending=pending();
            rejected(()->AxeNativeCallbackGuard.validateAndConsume(
                callback(),badRedirect,ISSUER,pending,NOW),"bad registered redirect");
        }
        for (String badIssuer: new String[] {
            "http://identity.example.test",
            "https://identity.example.test/other",
            "https://identity.example.test?foo=1",
            "https://identity.example.test:443",
            "https://user@identity.example.test",
            "https://localhost",
            "https://identity.example.test#fragment",
        }) {
            AxeNativeCallbackGuard.PendingAttempt pending=pending();
            rejected(()->AxeNativeCallbackGuard.validateAndConsume(
                callback(),REDIRECT,badIssuer,pending,NOW),"bad registered issuer");
        }

        // Both callbacks contend for a single PendingAttempt, with no race
        // that could accept the same state twice.
        AxeNativeCallbackGuard.PendingAttempt shared=pending();
        final int workers=32;
        AtomicInteger accepted=new AtomicInteger(),denied=new AtomicInteger();
        CountDownLatch ready=new CountDownLatch(workers),start=new CountDownLatch(1);
        Thread[] threads=new Thread[workers];
        for (int i=0;i<workers;i++) {
            threads[i]=new Thread(()->{
                ready.countDown();
                try {
                    start.await();
                    if (CODE.equals(use(callback(),shared))) accepted.incrementAndGet();
                } catch(IllegalArgumentException ignored) {
                    denied.incrementAndGet();
                } catch(InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
            });
            threads[i].start();
        }
        ready.await();
        start.countDown();
        for(Thread thread:threads)thread.join();
        ok(accepted.get()==1,"exactly one callback accepted with 32 threads");
        ok(denied.get()==workers-1,"all other callbacks rejected");
        ok(shared.isConsumed(),"raced state consumed");

        System.out.println("PASS: "+assertions+" native callback assertions; strict issuer/state/URL, expiry, one-shot and 32-way race.");
    }
}
