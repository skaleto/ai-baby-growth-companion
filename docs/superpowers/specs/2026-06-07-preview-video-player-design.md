# 自定义全屏视频播放器 + 预览顶栏 Spec v1

- 创建日期：2026-06-07
- 状态：前端 UI 改进 spec，进入 implementation plan 前需评审
- 适用范围：全屏媒体预览（`media-preview` 弹层）里的视频播放 UI、关闭按钮、顶部信息栏
- 不改动：相册瀑布流、相册内联自动播放（`AlbumVideoThumbnail`）、预览的轮播滑动、图片缩放/平移、上传与数据逻辑

## 0. 背景与目标

当前全屏预览里的视频用浏览器**原生 `<video controls>`**（[App.tsx:9455](frontend/src/App.tsx#L9455)、[App.tsx:9488](frontend/src/App.tsx#L9488)），在 iOS 上是系统默认控件，无法定制、偏丑；预览**没有关闭按钮**（只能点背景/下滑/Esc 关闭）；标题日期等信息在**底部** caption。

目标：

1. 自己实现一套**极简**全屏视频播放控件，替换原生 controls。
2. 预览**左上角**加关闭按钮（✕），图片和视频都生效。
3. 视频/图片的**标题、日期等信息展示在顶部**。

用户已确认的取舍：

- 关闭按钮：**整个预览**都加（图片+视频）。
- 打开视频：**自动播放且有声音**。
- 控件：**极简**（中间播放/暂停 + 底部细进度条）。
- 顶部信息栏：展示标题、日期之类。

## 1. 现状（事实依据）

- 预览弹层 `.media-preview`（`role="dialog"`）里是一个 `<figure>`，含：轮播 `media-preview-carousel`（相册项）或单个 attachment；底部 `figcaption.media-preview-details`（标题/日期/分类/记录人/标签/编辑删除）。[App.tsx:9436](frontend/src/App.tsx#L9436) 起。
- 视频用 `<video controls playsInline poster preload>`，当前项 `ref={bindPreviewVideo}`。
- `bindPreviewVideo`（[App.tsx:2716](frontend/src/App.tsx#L2716)）：设 `node.muted = false`；监听 `webkitendfullscreen` / `fullscreenchange` → `closePreviewAttachment`；cleanup 时 `node.pause()` + 解绑。不调用 `play()`。
- 关闭：`closePreviewAttachment`（[App.tsx:2662](frontend/src/App.tsx#L2662)）；背景点击 `handlePreviewClick`、Esc、下滑都已接。
- 预览样式在 `frontend/src/styles/app-base.css:1129` 起（不在 mobile-app.css）。
- 无任何关闭按钮、无自定义播放控件。

## 2. 组件：`PreviewVideoPlayer`

新建 `frontend/src/components/PreviewVideoPlayer.tsx`（独立组件；不内联进巨大的 App.tsx，也不引第三方播放库，避免 OTA 包变沉）。

**Props：**

- `attachment: Attachment` —— 视频附件。
- `active: boolean` —— 是否当前可见项（轮播当前/独立项为 true）。
- `bindVideo?: (node: HTMLVideoElement | null) => void` —— 转发给现有 `bindPreviewVideo`，保留其生命周期（muted=false、原生全屏退出→关闭、切换暂停清理）。

**渲染：**

- `<video playsInline preload="auto" poster={thumbnailUrl}>`，**不带原生 `controls`**，`object-fit: contain`（完整显示不裁切）。
- 用 callback ref 同时绑定组件内部 `videoRef` 与外部 `bindVideo`。

**极简控件（覆盖层）：**

- **点视频** → 播放/暂停切换，并显隐控件。
- **中间播放/暂停键**：暂停时显示圆形播放键；播放中约 2.5s 无操作自动隐藏；点一下重新显示。
- **底部细进度条**：显示已播放比例，可**拖动 seek**（pointer 拖动→设 `currentTime`）。
- **播完**：不循环（`loop` 关），结束显示中间「重播」键。
- 不含时间文字、静音键、全屏键（极简）。

**播放行为：**

- `active` 变为 true 时调用 `video.play()`（不静音，有声）。点击手势打开 → iOS 允许有声自动播放；若 `play()` 被拒，回退到展示中间播放键由用户点播。
- `active` 变为 false（轮播切走）时 `pause()` 并复位（`currentTime = 0`）。

## 3. 顶部信息栏 + 关闭按钮（整个预览，App.tsx 层）

在 `.media-preview` 弹层里、`<figure>` 之上加一个**顶部覆盖条** `.media-preview-topbar`：

- **左上角 ✕**（`.preview-close`）：圆形半透明深色按钮，点击 `closePreviewAttachment`，`stopPropagation`。
- **标题 + 日期 · 分类**（相册项有 `previewAlbumItem` 时）：标题加粗，下面一行 `日期 · 分类`，可选记录人 small。
- 顶部深色渐变背景，带 `env(safe-area-inset-top)` 顶部内边距（避刘海）。
- **持续显示**（不随播放自动隐藏），确保关闭始终可点。
- 图片和视频预览都显示。非相册项（无 `previewAlbumItem`）只显示 ✕（标题用 `attachment.name` 兜底可选）。

底部 caption 调整：把**标题/日期/分类/记录人移到顶部信息栏**，底部 `figcaption.media-preview-details` 只保留**标签 + 编辑/删除**（照护人可见），避免上下重复。

## 4. 接入点（App.tsx）

- 轮播当前项视频 [App.tsx:9455](frontend/src/App.tsx#L9455)：当前项用 `<PreviewVideoPlayer attachment active bindVideo={bindPreviewVideo} />`；**非当前项**只渲染封面（`<img src={thumbnailUrl || url}>`，无播放器）。
- 独立项视频 [App.tsx:9488](frontend/src/App.tsx#L9488)：用 `<PreviewVideoPlayer attachment active bindVideo={bindPreviewVideo} />`。
- 顶部信息栏 + ✕：加在 `.media-preview` 内、`<figure>` 前。
- 轮播滑动、图片缩放/平移、底部标签与编辑删除：保留。

## 5. CSS（加在 app-base.css 预览样式附近，约 1129+）

- `.media-preview-topbar`（顶部渐变条、flex、safe-area-inset-top）、`.preview-close`（左上圆形 ✕）、标题/日期文字样式。
- 播放器控件：`.preview-video-player`（相对定位容器）、中间播放键、`.preview-video-progress`（细进度条 + 已播放高亮 + 命中区域）、控件自动隐藏（opacity/visibility 过渡）。
- 视频去原生 controls 后的尺寸：`object-fit: contain`，撑满可用区。

## 6. 测试与验收

- **单测**（纯函数，放 `scripts/test-*.mjs` 风格或组件内纯函数抽出）：进度↔时间换算、拖动位置→`currentTime` 的比例换算（边界 0/末尾、超界夹取）。
- **build**：`npm run build` 通过（含类型检查）。
- **真机/截图自查**：
  - 点开视频→有声自动播放；点视频暂停/播放；中间键播放中自动隐藏、点击重现。
  - 底部细进度条可拖动 seek；播完显示重播。
  - 左上角 ✕ 关闭（图片和视频都在）；背景点击/下滑/Esc 仍可关。
  - 顶部显示标题 + 日期 · 分类；底部只剩标签 + 编辑/删除。
  - 轮播左右滑动切换正常；切走的视频暂停复位；图片缩放不受影响。

## 7. 不在本期范围（YAGNI）

- 音量滑块、播放倍速、画中画、原生全屏按钮。
- 时间文字、静音按钮（极简取舍；后续想要再加）。
- 顶栏随播放自动隐藏（本期持续显示，保关闭可达）。
- 相册内联自动播放组件（`AlbumVideoThumbnail`）的改动。
