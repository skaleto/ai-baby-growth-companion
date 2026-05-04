package com.xiaobao.growthcompanion;

import android.Manifest;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "AudioPermission",
    permissions = @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone")
)
public class AudioPermissionPlugin extends Plugin {}
