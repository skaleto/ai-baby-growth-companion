# Native Capability Benchmark

本文件配套 `scripts/native-capability-audit.mjs` 和 `scripts/test-native-capability-audit.mjs`。它解决一个很具体的问题：移动端能力不能被 Agent L2 或浏览器 smoke 假装覆盖，但也不能只靠人脑记住。

## 覆盖边界

| Capability | 产品面 | 当前证据 | 仍需真机验证 |
|---|---|---|---|
| `asr-voice-input` | 聊天按住说话、实时转写、松手自动发送给 Agent | 前端麦克风权限、ASR WebSocket、后端 Doubao ASR handler、Android/iOS 麦克风权限声明 | 真机麦克风授权、WebView 音频采集、实时 partial/final、弱网延迟 |
| `local-notifications` | 普通照护提醒、Pro 今日小结提醒 | Capacitor LocalNotifications 配置、前端调度/cancel 路径、Android 通知权限、iOS UNNotificationRequest | OS 权限弹窗、通知送达、点击动作、exact alarm 降级 |
| `full-screen-ringing` | 闹铃式提醒、全屏提醒页、循环铃声、关闭后续排 | AlarmReminder 插件、Android full-screen intent 权限、AlarmReceiver、AlarmRingingActivity、iOS 本地通知插件 | 锁屏唤醒、后台启动限制、铃声音频焦点、interval reschedule |
| `haptics` | 语音、保存、确认、失败/警告的触感反馈 | `frontend/src/haptics.ts` 封装 Capacitor Haptics，App 内调用成功/警告/选择反馈 | 真实触感强弱、频率是否打扰、低端 Android 支持情况 |
| `native-media-picker` | 原生相册选择照片/视频，进入聊天和相册链路 | NativeMediaPicker TS/Android/iOS 插件、Android PictureSelector、iOS PHPicker、媒体权限声明 | 真机选择/取消、视频元数据、本地 URI 转 File、大文件上传 |
| `ota-updater` | 移动 OTA 检查、下载、校验、应用 | CapacitorUpdater 配置、runtime check/download/set、build-mobile-update checksum | 真实下载进度、应用 bundle、回滚、up-to-date 状态 |
| `safe-area-keyboard` | 移动 WebView 安全区、键盘遮挡、底部 tab、表单弹层 | `useStableViewport`、safe-area CSS、iOS WebView inset 禁用、Android adjustResize | iOS visualViewport、系统键盘、输入聚焦/收起、页面跳动 |

## Fast Gate

```bash
node scripts/test-native-capability-audit.mjs
```

这个 gate 只证明“静态证据存在且索引没有漏项”。它不证明真机表现。凡是改动 `capacitor.config.ts`、`ios/`、`android/`、麦克风、媒体选择、通知、闹铃、haptics、键盘/安全区、WebView-only 逻辑，都还要按 `AGENTS.md` 跑：

```bash
npm run mobile:sync
npm run build:ios:debug
npm run build:android:debug
```

## Next Device Probe

下一步要补一个设备 probe 记录表，把每个 capability 的真机结果写回 harness：

| Capability | iOS | Android | 证据 |
|---|---|---|---|
| `asr-voice-input` | pending | pending | 录音转写截图/日志 |
| `local-notifications` | pending | pending | 通知送达截图/状态 |
| `full-screen-ringing` | pending | pending | 锁屏/后台触发记录 |
| `haptics` | pending | pending | 手工验收记录 |
| `native-media-picker` | pending | pending | 照片/视频上传与相册结果 |
| `ota-updater` | pending | pending | bundle version/check 结果 |
| `safe-area-keyboard` | pending | pending | 输入聚焦/收起截图 |
