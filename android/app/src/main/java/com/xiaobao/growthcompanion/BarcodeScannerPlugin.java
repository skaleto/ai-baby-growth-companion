package com.xiaobao.growthcompanion;

import android.app.Activity;
import android.content.Intent;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BarcodeScanner")
public class BarcodeScannerPlugin extends Plugin {

    @PluginMethod
    public void scan(PluginCall call) {
        Intent intent = new Intent(getContext(), BarcodeScannerActivity.class);
        try {
            startActivityForResult(call, intent, "scanResult");
        } catch (Exception error) {
            call.reject("Unable to open barcode scanner", error);
        }
    }

    @ActivityCallback
    private void scanResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject response = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            response.put("cancelled", true);
            call.resolve(response);
            return;
        }
        Intent data = result.getData();
        response.put("barcode", data.getStringExtra("barcode"));
        response.put("format", data.getStringExtra("format"));
        response.put("cancelled", false);
        call.resolve(response);
    }
}
