package com.axesistemas.axedespacho;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;

/**
 * DEBUG-ONLY LAB: collect location timestamps in memory so operators can
 * test a screen-locked device. No coordinates are sent, recorded, or exposed
 * to the WebView. Production tracking requires authenticated transport.
 */
public final class AxeLocationLabService extends Service implements LocationListener {
    public static final String ACTION_START = "com.axesistemas.axedespacho.LAB_START";
    public static final String ACTION_STOP = "com.axesistemas.axedespacho.LAB_STOP";
    private static final String CHANNEL_ID = "axe_despacho_gps_lab";
    private static final int NOTIFICATION_ID = 4301;
    private static volatile boolean running = false;
    private static volatile long lastFixAtMillis = 0L;
    private LocationManager locationManager;

    public static boolean isRunning() { return running; }
    public static long getLastFixAtMillis() { return lastFixAtMillis; }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!ACTION_START.equals(intent.getAction()) || !isDebuggable()) {
            stopSelf();
            return START_NOT_STICKY;
        }
        // The service MUST be started from a visible Activity, after the
        // while-in-use GPS permission has already been granted.
        if (!hasLocationPermission()) {
            stopSelf();
            return START_NOT_STICKY;
        }
        try {
            createChannel();
            Notification notification = notification();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
            locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
            boolean registered = false;
            if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                    && locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 15_000L, 10.0f, this);
                registered = true;
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 20_000L, 20.0f, this);
                registered = true;
            }
            if (!registered) {
                stopSelf();
                return START_NOT_STICKY;
            }
            running = true;
            return START_NOT_STICKY;
        } catch (Exception ignored) {
            // No exception details or coordinates should leak to crash logs.
            stopSelf();
            return START_NOT_STICKY;
        }
    }

    @Override
    public void onLocationChanged(Location location) {
        // Timestamp only, never cache or print latitude/longitude.
        if (location != null && location.hasAccuracy() && location.getAccuracy() <= 500f) {
            long time = location.getTime();
            long now = System.currentTimeMillis();
            if (time > lastFixAtMillis && time <= now && now - time <= 30_000L) {
                // Never replace a newer timestamp with an out-of-order GPS fix.
                // No latitude, longitude or other private location value is kept.
                lastFixAtMillis = time;
            }
        }
    }

    @Override
    public void onProviderDisabled(String provider) {
        if (locationManager != null
                && !locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)
                && !locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
            stopSelf();
        }
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // In laboratory mode a forced application dismissal ends tracking.
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        running = false;
        lastFixAtMillis = 0L;
        if (locationManager != null) {
            try { locationManager.removeUpdates(this); } catch (Exception ignored) {}
            locationManager = null;
        }
        try { stopForeground(true); } catch (Exception ignored) {}
        super.onDestroy();
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean isDebuggable() {
        return (getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "GPS de laboratório AXE Despacho", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Indica testes locais de GPS sem envio de coordenadas.");
            NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            manager.createNotificationChannel(channel);
        }
    }

    private Notification notification() {
        Intent stop = new Intent(this, AxeLocationLabService.class).setAction(ACTION_STOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent stopAction = PendingIntent.getService(this, 4301, stop, flags);
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        return builder
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("AXE Despacho - TESTE GPS")
                .setContentText("Rastreamento local de laboratório. Nenhum dado enviado.")
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Encerrar teste GPS", stopAction)
                .build();
    }
}
