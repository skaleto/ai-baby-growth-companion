package com.xiaobao.growthcompanion;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AudioPermissionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
