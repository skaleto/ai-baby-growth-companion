# 哄睡音乐设计（Sleep Music Design）

- 日期：2026-06-15
- 状态：设计已确认，待写实现计划
- 范围：从零给「小宝记」加一套哄睡音频——内置精选白噪音/摇篮曲，离线可用，**息屏续播 + 锁屏控制**，带睡眠定时（到点淡出停止）。
- 发布载体：**原生包**（新增原生插件 + 打包音频）——**不能 OTA**，必须发新 APK / iOS。

## 1. 目标与非目标

**目标（v1）**：
1. **音源**：内置 ~8–10 条精选，**完全离线**。白噪音（子宫声 / 雨声 / 海浪 / 吹风机 / 心跳 / 纯白噪音）+ 摇篮曲 2–3 首。
2. **后台/锁屏**：息屏、切后台继续播；锁屏与通知栏有**播放 / 暂停 / 停止**；占用音频焦点（来电或别的 App 放音时礼让）。
3. **睡眠定时**：`15 / 30 / 45 / 60 / 90` 分钟 + `不限时`；到点前最后 **~30 秒音量缓降淡出**，不「啪」地静音惊醒。
4. **播放页**：**暗色低亮**（夜间用，不刺眼）；曲目两组网格、当前播放 + 大播放/暂停、定时档 + 剩余、停止。
5. **入口**：首页/记录区一个「哄睡音乐」入口 → 开全屏播放页（不新增底部 tab）。

**非目标（v1 不做，留 v2）**：在线曲库扩展 / 用户自传音频；定时跟随宝宝睡眠检测；偏好跨端同步；音效叠加混音。

## 2. 现状

App **无任何音频系统**（仅提醒短铃声 `assets/sounds`、`assets/alarm`）；无音频类 Capacitor 插件。Capacitor **8.3.1**，iOS / Android 原生工程均在。本功能全新。

## 3. 选型（已定）

`@mediagrid/capacitor-native-audio`（v3，支持 Capacitor 8，在维护）。理由对比：

| 维度 | **mediagrid（选）** | jofr/capacitor-media-session（弃） |
|---|---|---|
| 播放方式 | 原生引擎（不碰 WebView 音频） | 仍用网页 `<audio>`，只加控制层 |
| 后台续播 | iOS + 安卓都稳 | 依赖 webview 音频，iOS 后台不稳 |
| 锁屏控制 | ✓ 内置（播/暂停/停/seek） | ✓ |
| 循环 / 音量（淡出靠它） | ✓ `loop` + `setVolume` | 自己实现 |
| Capacitor 8 | ✓ | ✗ 最高 Cap 6 → 出局 |

自研原生（前台服务 + AVAudioSession + MediaSession）成本高、用户明确「宁可第三方也别自研」，仅作 mediagrid 阻塞时的兜底。

## 4. 架构

照 `platform.ts` / `nativeAlarm.ts` 的端口层套路，把插件包在边界后面，Web 环境回退，保证浏览器里可开发可测 UI。

```
<SleepMusicScreen/> (memo, 暗色)            首页/记录区「哄睡音乐」入口 → 全屏
   │ 选曲/控制/定时
   ▼
useSleepAudio  控制器(hook)
   - 当前曲目 / 播放态 / 定时(JS) / 淡出(setVolume 斜降) / 中断暂停
   │ 调
   ▼
sleepAudio.ts  端口层
   - 原生: @mediagrid/capacitor-native-audio (load/play/pause/stop/setVolume/seek + 事件)
   - Web : <audio> 回退(无后台,仅供开发/测 UI)
   │ 曲目元数据
   ▼
sleepAudioCatalog.ts  纯模块(曲目注册表, 注入式资源, 守纯模块红线)
```

**新增文件**：
- `frontend/src/sleepAudioCatalog.ts`（纯）：`SLEEP_TRACKS: { id, title, category: "whitenoise"|"lullaby", loop, assetKey, icon }[]`。不 import 资源——`assetKey → 原生文件路径` 的映射由注入提供（照 `albumIcons.ts` / `posterUpload.ts` 注入套路）。
- `frontend/src/sleepAudio.ts`（端口层）：`isSleepAudioNative()`、`load/play/pause/stop/setVolume/seek`、订阅锁屏控制与中断事件；Web 分支用 `<audio>`。
- `frontend/src/hooks/useSleepAudio.ts`（控制器）：状态机 + 定时（`setTimeout(档*60s)`，末 30s 用 interval 把 volume 线性降到 0 后 `stop`）+ 中断处理。
- `frontend/src/screens/SleepMusicScreen.tsx`（memo，暗色 UI）。
- 音频资源：打包进原生（android `assets/` / iOS bundle）。**离线策略 v1 = 打包内置**（即装即用，代价包体 +几 MB）；download-to-Filesystem 留作备选（见风险）。

**结构性测试钩子**：端口层禁止 UI/控制器直接 `import @mediagrid/...`（照 D11 端口层规则，结构测试可加断言）。

## 5. 数据 / 状态

- **后端零改动**：哄睡是本地播放，无跨端数据。
- 偏好（上次曲目 id、上次定时档）存 `localStorage`，不进 app/state 契约。
- 曲目元数据来自静态 catalog。

## 6. 交互流程

1. **选曲** → `sleepAudio.load(assetPath, { loop:true })` → `play()` → now-playing 更新 → 写锁屏 now-playing 信息（插件）。
2. **锁屏 播/暂停/停** → 插件事件 → 控制器同步 UI（双向一致）。
3. **定时** → 选档起 `setTimeout`；末 30s 把 `volume` 从当前线性降到 0 → 到点 `stop()`，UI 归位。切档/停止时清掉旧定时与淡出。
4. **音频焦点中断**（来电 / 别 App 放音）→ 插件中断事件 → 暂停；v1 中断后**保持暂停**（不自动续播），用户回来手动续。

## 7. 错误处理 / 降级

- **插件不可用**（Web / 预览 / 旧版 App）→ `<audio>` 前台回退；UI 可测；明示「后台播放需更新到最新 App」。
- **资源缺失 / 解码失败** → toast 提示 + 不崩，停在可选曲列表。
- **后台权限 / 前台服务起不来** → 至少前台可播（不黑屏不崩）。

## 8. 测试

- `sleepAudioCatalog.ts` 纯模块：node 单测（id 唯一、字段完备、分类合法）。
- `useSleepAudio` 定时 + 淡出：单测（注入 mock 音频端口 + 假时钟，断言末段 `setVolume` 递降到 0 后 `stop`）。
- `SleepMusicScreen` DOM smoke（Web 回退路径）：选曲→暂停→选定时→停止，断言端口被正确调用。
- **真·后台 / 锁屏 / 音频焦点 / 淡出听感**：headless 测不了 → **真机手测**，列入验收清单（iOS + 华为各一轮）。

## 9. 发布 / 原生配置

- **原生包**（新插件 + 打包音频）→ 发新 APK / iOS，**不走 OTA**。
- iOS：开 `UIBackgroundModes → audio`；配 now-playing 信息。
- Android：前台服务声明（`foregroundServiceType=mediaPlayback`）+ `FOREGROUND_SERVICE` / `WAKE_LOCK` 权限。

## 10. 风险 / 待验证（实现首步先验）

1. **mediagrid 是否支持本地文件路径播放**（offline 刚需）→ 实现第一步就验；若仅支持 URL，则改 download-to-Filesystem 后用 `file://` 播。
2. **音频焦点 / 中断是否内置**→ 实测；不行则在端口层补一层（监听系统中断 → 暂停）。
3. **摇篮曲版权**：仅用**免版税**曲库或自行合成；白噪音可程序生成 / 免版税。**绝不用受版权保护的现成录音**（内容待办）。
4. **包体**：内置音频使 APK / IPA 增大几 MB；必要时压缩或改按需下载。
