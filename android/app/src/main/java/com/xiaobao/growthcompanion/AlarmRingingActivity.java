package com.xiaobao.growthcompanion;

import android.app.Activity;
import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class AlarmRingingActivity extends Activity {
    private JSONObject alarm;
    private MediaPlayer mediaPlayer;
    private int notificationId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prepareWindow();

        notificationId = getIntent().getIntExtra("notificationId", 0);
        alarm = AlarmReminderStore.read(this, notificationId);
        if (alarm == null) {
            finish();
            return;
        }

        setContentView(buildContent());
        startLoopingSound();
    }

    @Override
    protected void onDestroy() {
        stopSound();
        super.onDestroy();
    }

    private void prepareWindow() {
        Window window = getWindow();
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (keyguardManager != null) keyguardManager.requestDismissKeyguard(this, null);
        }
    }

    private View buildContent() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(255, 248, 236));

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        int padding = dp(24);
        content.setPadding(padding, dp(28), padding, dp(28));
        root.addView(content, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        ImageView scene = new ImageView(this);
        scene.setImageResource(R.drawable.alarm_scene);
        scene.setAdjustViewBounds(true);
        scene.setScaleType(ImageView.ScaleType.CENTER_CROP);
        GradientDrawable imageBackground = rounded(Color.rgb(255, 252, 244), dp(8), Color.rgb(244, 225, 202), dp(1));
        scene.setBackground(imageBackground);
        scene.setClipToOutline(true);
        LinearLayout.LayoutParams imageParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            0,
            1.1f
        );
        imageParams.setMargins(0, 0, 0, dp(20));
        content.addView(scene, imageParams);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.CENTER_HORIZONTAL);
        card.setPadding(dp(20), dp(22), dp(20), dp(22));
        card.setBackground(rounded(Color.WHITE, dp(8), Color.rgb(238, 220, 197), dp(1)));
        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        content.addView(card, cardParams);

        TextView eyebrow = text("小宝闹铃提醒", 15, Color.rgb(88, 121, 104), Typeface.BOLD);
        eyebrow.setGravity(Gravity.CENTER);
        card.addView(eyebrow);

        TextView title = text("到提醒时间啦", 30, Color.rgb(35, 45, 51), Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        titleParams.setMargins(0, dp(8), 0, dp(8));
        card.addView(title, titleParams);

        int interval = alarm.optInt("intervalMinutes", 0);
        boolean intervalMode = "interval".equals(alarm.optString("scheduleMode")) && interval > 0;
        String reminderTitle = alarm.optString("title", "小宝记提醒");
        String intervalText = intervalMode ? reminderTitle + " · 每 " + formatInterval(interval) : reminderTitle;
        TextView rule = text(intervalText, 17, Color.rgb(101, 115, 112), Typeface.NORMAL);
        rule.setGravity(Gravity.CENTER);
        card.addView(rule);

        String dueText = alarm.optString("dueText", "");
        TextView due = text(dueText.isEmpty() ? "轻轻看看这次提醒" : "本次提醒：" + dueText, 15, Color.rgb(127, 135, 133), Typeface.NORMAL);
        due.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams dueParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        dueParams.setMargins(0, dp(8), 0, dp(18));
        card.addView(due, dueParams);

        Button close = new Button(this);
        close.setText("关闭本次");
        close.setTextSize(18);
        close.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        close.setTextColor(Color.WHITE);
        close.setAllCaps(false);
        close.setBackground(rounded(Color.rgb(86, 166, 126), dp(8), Color.rgb(70, 139, 105), dp(1)));
        close.setMinHeight(dp(56));
        close.setOnClickListener((view) -> closeCurrentAlarm());
        card.addView(close, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(58)
        ));

        TextView helper = text(intervalMode ? "关闭后会自动安排下一次提醒" : "关闭后本次提醒结束", 14, Color.rgb(127, 135, 133), Typeface.NORMAL);
        helper.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams helperParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        helperParams.setMargins(0, dp(14), 0, 0);
        card.addView(helper, helperParams);

        return root;
    }

    private void startLoopingSound() {
        stopSound();
        int sound = "soft_bell".equals(alarm.optString("soundId")) ? R.raw.xiaobao_bell : R.raw.xiaobao_chime;
        mediaPlayer = MediaPlayer.create(this, sound);
        if (mediaPlayer == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
        }
        mediaPlayer.setLooping(true);
        mediaPlayer.start();
    }

    private void stopSound() {
        if (mediaPlayer == null) return;
        try {
            if (mediaPlayer.isPlaying()) mediaPlayer.stop();
        } catch (IllegalStateException ignored) {
        }
        mediaPlayer.release();
        mediaPlayer = null;
    }

    private void closeCurrentAlarm() {
        stopSound();
        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) notificationManager.cancel(notificationId);

        long handledAt = System.currentTimeMillis();
        int intervalMinutes = alarm.optInt("intervalMinutes", 0);
        boolean intervalMode = "interval".equals(alarm.optString("scheduleMode")) && intervalMinutes > 0;
        try {
            JSONObject event = new JSONObject();
            event.put("type", "alarm_closed_current");
            event.put("reminderId", alarm.optString("reminderId"));
            event.put("notificationId", notificationId);
            event.put("handledAt", AlarmReminderStore.isoFromMillis(handledAt));
            if (intervalMode) {
                long nextDueAt = handledAt + intervalMinutes * 60_000L;
                alarm.put("dueAt", AlarmReminderStore.isoFromMillis(nextDueAt));
                alarm.put("dueText", localDueText(nextDueAt));
                alarm.put("lastHandledAt", AlarmReminderStore.isoFromMillis(handledAt));
                boolean exact = AlarmReminderStore.schedule(this, alarm);
                event.put("nextDueAt", AlarmReminderStore.isoFromMillis(nextDueAt));
                event.put("intervalMinutes", intervalMinutes);
                event.put("exact", exact);
            } else {
                AlarmReminderStore.remove(this, notificationId);
            }
            AlarmReminderStore.appendEvent(this, event);
        } catch (JSONException ignored) {
        }
        finish();
    }

    private TextView text(String value, int sp, int color, int style) {
        TextView textView = new TextView(this);
        textView.setText(value);
        textView.setTextSize(sp);
        textView.setTextColor(color);
        textView.setTypeface(Typeface.DEFAULT, style);
        textView.setIncludeFontPadding(true);
        return textView;
    }

    private GradientDrawable rounded(int color, int radius, int strokeColor, int strokeWidth) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(radius);
        drawable.setStroke(strokeWidth, strokeColor);
        return drawable;
    }

    private String formatInterval(int minutes) {
        if (minutes % 60 == 0) return (minutes / 60) + " 小时";
        if (minutes < 60) return minutes + " 分钟";
        return (minutes / 60) + " 小时 " + (minutes % 60) + " 分钟";
    }

    private String localDueText(long millis) {
        return new SimpleDateFormat("MM月dd日 HH:mm", Locale.CHINA).format(new Date(millis));
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
