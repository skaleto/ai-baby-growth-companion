package com.xiaobao.growthcompanion;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONException;
import org.json.JSONObject;

public class AlarmReceiver extends BroadcastReceiver {
    private static final String RINGING_CHANNEL_ID = "baby_fullscreen_alarm_v1";
    private static final String NOTIFICATION_CHANNEL_ID = "baby_interval_notification_v1";

    @Override
    public void onReceive(Context context, Intent intent) {
        int notificationId = intent.getIntExtra("notificationId", 0);
        JSONObject alarm = AlarmReminderStore.read(context, notificationId);
        if (alarm == null) return;

        if ("ringing".equals(alarm.optString("alertMode", "ringing"))) {
            showRingingReminder(context, notificationId, alarm);
        } else {
            showNotificationReminder(context, notificationId, alarm);
        }
    }

    private void showRingingReminder(Context context, int notificationId, JSONObject alarm) {
        ensureRingingChannel(context);

        Intent activityIntent = new Intent(context, AlarmRingingActivity.class);
        activityIntent.putExtra("notificationId", notificationId);
        activityIntent.putExtra("reminderId", alarm.optString("reminderId"));
        activityIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent fullScreenIntent = PendingIntent.getActivity(context, notificationId, activityIntent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, RINGING_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(alarm.optString("title", "到提醒时间啦"))
            .setContentText(alarm.optString("body", "轻轻提醒一下，该看看小宝是不是要喝奶啦。"))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setColor(Color.rgb(95, 166, 129))
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(fullScreenIntent)
            .setFullScreenIntent(fullScreenIntent, true);

        try {
            NotificationManagerCompat.from(context).notify(notificationId, builder.build());
        } catch (SecurityException ignored) {
            // Notification permission may be disabled; still try to open the foreground alarm page.
        }

        try {
            context.startActivity(activityIntent);
        } catch (RuntimeException ignored) {
            // Some Android builds block background starts; full-screen notification remains as fallback.
        }
    }

    private void showNotificationReminder(Context context, int notificationId, JSONObject alarm) {
        ensureNotificationChannel(context);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(alarm.optString("title", "小宝记提醒"))
            .setContentText(alarm.optString("body", alarm.optString("dueText", "到提醒时间啦")))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setColor(Color.rgb(95, 166, 129))
            .setAutoCancel(true);

        try {
            NotificationManagerCompat.from(context).notify(notificationId, builder.build());
        } catch (SecurityException ignored) {
            // Notification permission may be disabled; still keep the event queue coherent.
        }
        handleNotificationTriggered(context, notificationId, alarm);
    }

    private void handleNotificationTriggered(Context context, int notificationId, JSONObject alarm) {
        long handledAt = System.currentTimeMillis();
        int intervalMinutes = alarm.optInt("intervalMinutes", 0);
        boolean interval = "interval".equals(alarm.optString("scheduleMode")) && intervalMinutes > 0;
        try {
            JSONObject event = new JSONObject();
            event.put("type", "reminder_triggered");
            event.put("reminderId", alarm.optString("reminderId"));
            event.put("notificationId", notificationId);
            event.put("handledAt", AlarmReminderStore.isoFromMillis(handledAt));
            if (interval) {
                long nextDueAt = handledAt + intervalMinutes * 60_000L;
                alarm.put("dueAt", AlarmReminderStore.isoFromMillis(nextDueAt));
                alarm.put("dueText", localDueText(nextDueAt));
                boolean exact = AlarmReminderStore.schedule(context, alarm);
                event.put("nextDueAt", AlarmReminderStore.isoFromMillis(nextDueAt));
                event.put("intervalMinutes", intervalMinutes);
                event.put("exact", exact);
            } else {
                AlarmReminderStore.remove(context, notificationId);
            }
            AlarmReminderStore.appendEvent(context, event);
        } catch (JSONException ignored) {
        }
    }

    private void ensureRingingChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(RINGING_CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(
            RINGING_CHANNEL_ID,
            "小宝全屏闹铃",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("闹铃提醒，到点后进入全屏提醒页");
        channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        channel.enableVibration(false);
        Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/" + R.raw.xiaobao_chime);
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        channel.setSound(soundUri, attributes);
        manager.createNotificationChannel(channel);
    }

    private void ensureNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(NOTIFICATION_CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            "小宝循环通知",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("循环或一次性普通通知提醒");
        channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        channel.enableVibration(false);
        channel.setSound(null, null);
        manager.createNotificationChannel(channel);
    }

    private String localDueText(long millis) {
        return new java.text.SimpleDateFormat("MM月dd日 HH:mm", java.util.Locale.CHINA)
            .format(new java.util.Date(millis));
    }
}
