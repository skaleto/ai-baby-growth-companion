package com.xiaobao.growthcompanion;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "AlarmReminder")
public class AlarmReminderPlugin extends Plugin {
    @PluginMethod
    public void scheduleAlarm(PluginCall call) {
        String reminderId = call.getString("reminderId", "");
        String dueAt = call.getString("dueAt", "");
        if (reminderId.isEmpty() || dueAt.isEmpty()) {
            call.reject("reminderId and dueAt are required");
            return;
        }

        int notificationId = call.getInt("notificationId", Math.abs(reminderId.hashCode()));
        int intervalMinutes = call.getInt("intervalMinutes", 0);
        String scheduleMode = call.getString("scheduleMode", intervalMinutes > 0 ? "interval" : "once");
        String alertMode = call.getString("alertMode", "ringing");
        if (!"once".equals(scheduleMode) && !"interval".equals(scheduleMode)) {
            call.reject("scheduleMode must be once or interval");
            return;
        }
        if (!"notification".equals(alertMode) && !"ringing".equals(alertMode)) {
            call.reject("alertMode must be notification or ringing");
            return;
        }
        if ("interval".equals(scheduleMode) && intervalMinutes <= 0) {
            call.reject("intervalMinutes must be positive for interval reminders");
            return;
        }

        try {
            JSONObject alarm = new JSONObject();
            alarm.put("reminderId", reminderId);
            alarm.put("notificationId", notificationId);
            alarm.put("title", call.getString("title", "到喂奶时间啦"));
            alarm.put("body", call.getString("body", "轻轻提醒一下，该看看小宝是不是要喝奶啦。"));
            alarm.put("dueText", call.getString("dueText", ""));
            alarm.put("dueAt", dueAt);
            alarm.put("scheduleMode", scheduleMode);
            alarm.put("alertMode", alertMode);
            alarm.put("intervalMinutes", intervalMinutes);
            alarm.put("soundId", call.getString("soundId", "soft_chime"));

            boolean exact = AlarmReminderStore.schedule(getContext(), alarm);
            JSObject result = new JSObject();
            result.put("scheduled", true);
            result.put("exact", exact);
            call.resolve(result);
        } catch (JSONException error) {
            call.reject("Failed to build alarm payload", error);
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        String reminderId = call.getString("reminderId", "");
        int notificationId = call.getInt("notificationId", Math.abs(reminderId.hashCode()));
        AlarmReminderStore.cancel(getContext(), notificationId, reminderId);
        JSObject result = new JSObject();
        result.put("cancelled", true);
        call.resolve(result);
    }

    @PluginMethod
    public void consumeAlarmEvents(PluginCall call) {
        JSONArray events = AlarmReminderStore.consumeEvents(getContext());
        JSObject result = new JSObject();
        try {
            result.put("events", new JSArray(events.toString()));
        } catch (JSONException ignored) {
            result.put("events", new JSArray());
        }
        call.resolve(result);
    }
}
