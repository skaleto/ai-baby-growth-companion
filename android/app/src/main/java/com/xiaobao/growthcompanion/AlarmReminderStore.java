package com.xiaobao.growthcompanion;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

final class AlarmReminderStore {
    static final String ACTION_TRIGGER = "com.xiaobao.growthcompanion.ALARM_TRIGGER";
    static final String PREFS = "xiaobao_alarm_reminders";
    static final String EVENT_QUEUE = "alarm_events";

    private AlarmReminderStore() {
    }

    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static int requestCode(JSONObject alarm) {
        return alarm.optInt("notificationId", Math.abs(alarm.optString("reminderId", "alarm").hashCode()));
    }

    static String alarmKey(int notificationId) {
        return "alarm_" + notificationId;
    }

    static void save(Context context, JSONObject alarm) {
        preferences(context)
            .edit()
            .putString(alarmKey(requestCode(alarm)), alarm.toString())
            .apply();
    }

    static JSONObject read(Context context, int notificationId) {
        String raw = preferences(context).getString(alarmKey(notificationId), null);
        if (raw == null) return null;
        try {
            return new JSONObject(raw);
        } catch (JSONException ignored) {
            return null;
        }
    }

    static void remove(Context context, int notificationId) {
        preferences(context).edit().remove(alarmKey(notificationId)).apply();
    }

    static PendingIntent triggerIntent(Context context, int notificationId, String reminderId) {
        Intent intent = new Intent(context, AlarmReceiver.class);
        intent.setAction(ACTION_TRIGGER);
        intent.putExtra("notificationId", notificationId);
        intent.putExtra("reminderId", reminderId);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(context, notificationId, intent, flags);
    }

    static boolean canScheduleExact(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        return alarmManager != null && alarmManager.canScheduleExactAlarms();
    }

    static boolean schedule(Context context, JSONObject alarm) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return false;

        int notificationId = requestCode(alarm);
        long triggerAt = Math.max(parseIsoMillis(alarm.optString("dueAt")), System.currentTimeMillis() + 1000L);
        PendingIntent pendingIntent = triggerIntent(context, notificationId, alarm.optString("reminderId"));
        boolean exact = canScheduleExact(context);

        if (exact) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
        } else {
            alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
        }
        save(context, alarm);
        return exact;
    }

    static void cancel(Context context, int notificationId, String reminderId) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            alarmManager.cancel(triggerIntent(context, notificationId, reminderId));
        }
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.cancel(notificationId);
        }
        remove(context, notificationId);
    }

    static void appendEvent(Context context, JSONObject event) {
        SharedPreferences preferences = preferences(context);
        JSONArray events = new JSONArray();
        String raw = preferences.getString(EVENT_QUEUE, "[]");
        try {
            events = new JSONArray(raw);
        } catch (JSONException ignored) {
            events = new JSONArray();
        }
        events.put(event);
        preferences.edit().putString(EVENT_QUEUE, events.toString()).apply();
    }

    static JSONArray consumeEvents(Context context) {
        SharedPreferences preferences = preferences(context);
        String raw = preferences.getString(EVENT_QUEUE, "[]");
        preferences.edit().putString(EVENT_QUEUE, "[]").commit();
        try {
            return new JSONArray(raw);
        } catch (JSONException ignored) {
            return new JSONArray();
        }
    }

    static long parseIsoMillis(String value) {
        if (value == null || value.isEmpty()) return System.currentTimeMillis();
        String[] patterns = {
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
            "yyyy-MM-dd'T'HH:mm:ssXXX"
        };
        for (String pattern : patterns) {
            try {
                SimpleDateFormat formatter = new SimpleDateFormat(pattern, Locale.US);
                if (pattern.endsWith("'Z'")) formatter.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date date = formatter.parse(value);
                if (date != null) return date.getTime();
            } catch (ParseException ignored) {
            }
        }
        return System.currentTimeMillis();
    }

    static String isoFromMillis(long millis) {
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        formatter.setTimeZone(TimeZone.getTimeZone("UTC"));
        return formatter.format(new Date(millis));
    }
}
