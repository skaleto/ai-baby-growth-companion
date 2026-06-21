#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const nativeCapabilityAudit = [
  {
    id: "asr-voice-input",
    productSurface: "Chat composer press-to-talk and realtime transcript-to-Agent input.",
    status: "requires_device",
    requiredGate: "Static audit plus backend ASR tests; real proof needs a native microphone/WebSocket probe on device.",
    deviceGap: "Browser tests cannot prove native microphone permission prompts, WebView audio capture stability, or realtime ASR latency.",
    manualProbe: "On iOS and Android, grant microphone permission, hold voice input, speak a short record, verify partial/final transcript and auto-submit.",
    staticEvidence: [
      { path: "frontend/src/audioPermission.ts", includes: 'registerPlugin<AudioPermissionPlugin>("AudioPermission")' },
      { path: "frontend/src/asrApi.ts", includes: 'parsed.pathname = "/api/asr/stream";' },
      { path: "backend/src/main/java/com/xiaobao/babycompanion/asr/DoubaoAsrWebSocketHandler.java", includes: "Only 16kHz mono pcm_s16le audio is supported" },
      { path: "android/app/src/main/AndroidManifest.xml", includes: "android.permission.RECORD_AUDIO" },
      { path: "ios/App/App/Info.plist", includes: "NSMicrophoneUsageDescription" },
    ],
  },
  {
    id: "local-notifications",
    productSurface: "Daily summary reminders and normal care reminders scheduled as device notifications.",
    status: "requires_device",
    requiredGate: "Static audit plus npm run mobile:sync/native debug build when reminder scheduling changes.",
    deviceGap: "Desktop Playwright cannot prove OS notification permission, channel creation, exact-alarm fallback, or delivered notification actions.",
    manualProbe: "On iOS and Android, create a near-future notification reminder, grant/deny permissions, and verify scheduled/delivered/cancelled states.",
    staticEvidence: [
      { path: "capacitor.config.ts", includes: "LocalNotifications" },
      { path: "frontend/src/App.tsx", includes: "const scheduleNativeReminders = async" },
      { path: "frontend/src/App.tsx", includes: "LocalNotifications.schedule" },
      { path: "android/app/src/main/AndroidManifest.xml", includes: "android.permission.POST_NOTIFICATIONS" },
      { path: "ios/App/App/AlarmReminderPlugin.swift", includes: "UNNotificationRequest" },
    ],
  },
  {
    id: "full-screen-ringing",
    productSurface: "Ringing reminders that open the full-screen alarm experience and loop the selected sound.",
    status: "requires_device",
    requiredGate: "Static audit plus Android/iOS native build; real proof needs lock-screen/background delivery on device.",
    deviceGap: "Simulator/browser checks cannot prove Android full-screen intent behavior, lock-screen wake, OEM background-start limits, or audio focus.",
    manualProbe: "On Android and iOS, schedule a ringing reminder one minute out, lock the device, verify wake/full-screen-or-notification behavior, looping sound, close, and interval reschedule.",
    staticEvidence: [
      { path: "frontend/src/nativeAlarm.ts", includes: 'registerPlugin<NativeAlarmPlugin>("AlarmReminder")' },
      { path: "android/app/src/main/AndroidManifest.xml", includes: "android.permission.USE_FULL_SCREEN_INTENT" },
      { path: "android/app/src/main/java/com/xiaobao/growthcompanion/AlarmReceiver.java", includes: ".setFullScreenIntent(fullScreenIntent, true)" },
      { path: "android/app/src/main/java/com/xiaobao/growthcompanion/AlarmRingingActivity.java", includes: "FLAG_SHOW_WHEN_LOCKED" },
      { path: "ios/App/App/AlarmReminderPlugin.swift", includes: 'let jsName = "AlarmReminder"' },
    ],
  },
  {
    id: "haptics",
    productSurface: "Light tactile feedback for voice, save/confirm, warning, and success interactions.",
    status: "requires_device",
    requiredGate: "Static audit plus native device spot check after haptic interaction changes.",
    deviceGap: "Haptic APIs are no-ops outside supported native devices and cannot be felt or measured by browser smoke tests.",
    manualProbe: "On iOS and Android, trigger voice press, successful save, and validation warning; verify tactile feedback is present and not excessive.",
    staticEvidence: [
      { path: "frontend/src/haptics.ts", includes: '@capacitor/haptics' },
      { path: "frontend/src/haptics.ts", includes: "Haptics.notification" },
      { path: "frontend/src/App.tsx", includes: "hapticSuccess()" },
    ],
  },
  {
    id: "native-media-picker",
    productSurface: "Native photo/video selection for chat attachments and album media.",
    status: "requires_device",
    requiredGate: "Static audit plus native media picker probe on device after picker, upload, or attachment changes.",
    deviceGap: "Browser upload fixtures cannot prove iOS PHPicker, Android Photo Picker/OpenDocument, permission edge cases, local URI conversion, or video metadata.",
    manualProbe: "On iOS and Android, attach one photo and one video through native picker, verify upload, chat preview, album classification, and cancel handling.",
    staticEvidence: [
      { path: "frontend/src/nativeMediaPicker.ts", includes: 'registerPlugin<NativeMediaPickerPlugin>("NativeMediaPicker")' },
      { path: "android/app/src/main/java/com/xiaobao/growthcompanion/MainActivity.java", includes: "registerPlugin(NativeMediaPickerPlugin.class)" },
      { path: "android/app/src/main/java/com/xiaobao/growthcompanion/NativeMediaPickerPlugin.java", includes: "PictureSelector.create" },
      { path: "ios/App/App/AppViewController.swift", includes: "registerPluginInstance(NativeMediaPickerPlugin())" },
      { path: "ios/App/App/NativeMediaPickerPlugin.swift", includes: "PHPickerViewController" },
      { path: "android/app/src/main/AndroidManifest.xml", includes: "android.permission.READ_MEDIA_IMAGES" },
      { path: "ios/App/App/Info.plist", includes: "NSPhotoLibraryUsageDescription" },
    ],
  },
  {
    id: "ota-updater",
    productSurface: "Capgo/Capacitor OTA bundle check, download, checksum validation, and apply flow.",
    status: "requires_device",
    requiredGate: "Static audit plus mobile update bundle build and /api/mobile-updates/check probe; native apply still needs device validation.",
    deviceGap: "Backend OTA check and bundle checksum do not prove Capgo download progress events, set/apply behavior, rollback, or native bundle readiness.",
    manualProbe: "On installed iOS and Android builds, publish a test OTA, verify download progress notice, app restart/apply, current bundle version, and up-to-date check.",
    staticEvidence: [
      { path: "capacitor.config.ts", includes: "CapacitorUpdater" },
      { path: "frontend/src/mobileUpdates.ts", includes: "CapacitorUpdater.download" },
      { path: "frontend/src/mobileUpdates.ts", includes: "CapacitorUpdater.set" },
      { path: "scripts/build-mobile-update.sh", includes: "CHECKSUM" },
      { path: "package.json", includes: "@capgo/capacitor-updater" },
    ],
  },
  {
    id: "safe-area-keyboard",
    productSurface: "Mobile WebView viewport, keyboard inset, tab bar, and safe-area layout stability.",
    status: "requires_device",
    requiredGate: "npm run verify:frontend for viewport smoke plus native device check after layout, keyboard, safe-area, or WebView changes.",
    deviceGap: "Playwright mobile viewports cannot fully reproduce iOS visualViewport, system keyboard movement, native safe areas, or WebView scroll offset bugs.",
    manualProbe: "On iOS and Android, focus chat/reminder/ledger inputs, rotate where supported, dismiss keyboard, and verify no overlap, page jump, or hidden primary action.",
    staticEvidence: [
      { path: "frontend/src/hooks/useStableViewport.ts", includes: "--keyboard-inset" },
      { path: "frontend/src/styles/mobile-app.css", includes: "env(safe-area-inset-bottom)" },
      { path: "ios/App/App/AppViewController.swift", includes: "contentInsetAdjustmentBehavior = .never" },
      { path: "android/app/src/main/AndroidManifest.xml", includes: 'android:windowSoftInputMode="adjustResize"' },
    ],
  },
];

const allowedStatuses = new Set(["static_covered", "requires_device", "unsupported"]);

export function validateNativeCapabilityAudit({ repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url))) } = {}) {
  const errors = [];
  const ids = new Set();

  for (const capability of nativeCapabilityAudit) {
    if (!capability.id) errors.push("capability missing id");
    if (ids.has(capability.id)) errors.push(`duplicate capability id ${capability.id}`);
    ids.add(capability.id);
    if (!allowedStatuses.has(capability.status)) errors.push(`${capability.id} has unsupported status ${capability.status}`);
    if (!capability.productSurface) errors.push(`${capability.id} missing productSurface`);
    if (!capability.requiredGate) errors.push(`${capability.id} missing requiredGate`);
    if (!Array.isArray(capability.staticEvidence) || capability.staticEvidence.length === 0) {
      errors.push(`${capability.id} missing staticEvidence`);
      continue;
    }
    if (capability.status === "requires_device") {
      if (!capability.deviceGap) errors.push(`${capability.id} missing deviceGap`);
      if (!capability.manualProbe) errors.push(`${capability.id} missing manualProbe`);
    }
    for (const evidence of capability.staticEvidence) {
      const evidencePath = path.join(repoRoot, evidence.path || "");
      if (!evidence.path || !fs.existsSync(evidencePath)) {
        errors.push(`${capability.id} evidence path missing: ${evidence.path}`);
        continue;
      }
      if (evidence.includes) {
        const content = fs.readFileSync(evidencePath, "utf8");
        if (!content.includes(evidence.includes)) {
          errors.push(`${capability.id} evidence ${evidence.path} missing string ${evidence.includes}`);
        }
      }
    }
  }

  return {
    capabilityCount: nativeCapabilityAudit.length,
    deviceRequiredCount: nativeCapabilityAudit.filter((capability) => capability.status === "requires_device").length,
    errors,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateNativeCapabilityAudit();
  if (result.errors.length) {
    console.error(result.errors.join("\n"));
    process.exit(1);
  }
  console.log(`native capability audit passed: ${result.capabilityCount} capabilities, ${result.deviceRequiredCount} require device probes`);
}
