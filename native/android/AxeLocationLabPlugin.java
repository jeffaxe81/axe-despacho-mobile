package com.axesistemas.axedespacho;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Native Android debug-only lab plugin.
 * Starting is never permitted without a visible Activity and explicit GPS permission.
 * No network access, no token management, no coordinate payload.
 */
@CapacitorPlugin(name = "AxeLocationLab")
public final class AxeLocationLabPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        if ((getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0) {
            call.reject("Funcionalidade disponível somente no APK de laboratório.");
            return;
        }
        Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || !activity.hasWindowFocus()) {
            call.reject("Abra o aplicativo para iniciar a localização. O GPS não pode ser iniciado em segundo plano.");
            return;
        }
        boolean fine = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        if (!fine && !coarse) {
            call.reject("Permissão GPS não concedida.");
            return;
        }
        try {
            Intent start = new Intent(getContext(), AxeLocationLabService.class)
                    .setAction(AxeLocationLabService.ACTION_START);
            ContextCompat.startForegroundService(getContext(), start);
            JSObject result = new JSObject();
            result.put("requested", true);
            call.resolve(result);
        } catch (Exception ignored) {
            call.reject("Android não permitiu iniciar o serviço de localização.");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), AxeLocationLabService.class));
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("running", AxeLocationLabService.isRunning());
        result.put("lastFixAt", AxeLocationLabService.getLastFixAtMillis());
        result.put("uploadsEnabled", false);
        call.resolve(result);
    }
}
