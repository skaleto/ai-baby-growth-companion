# 相册自适应瀑布流 + 视频自动播放 Spec v1

- 创建日期：2026-06-07
- 状态：前端 UI 改进 spec，进入 implementation plan 前需评审
- 适用范围：相册页（`相册 / 成长回忆库`）的媒体陈列样式与视频预览行为
- 不改动：相册数据模型、分类筛选、上传链路、全屏预览（`openPreviewAttachment`）逻辑

## 0. 背景与目标

当前相册把所有图片/视频铺成统一的方形网格（"豆腐块"），用 `object-fit: cover` 强裁成正方形，视觉凌乱且丢失原图比例；视频只显示静止首帧、不播放。

目标：

1. 图片与视频**按各自真实长宽比**陈列、不裁切，整体更自然（瀑布流）。
2. 视频**进入视野即静音循环自动播放**，划走即暂停。

用户已确认的取舍：

- 布局：**双列瀑布流（固定 2 列）**，**按日期排列**。
- 保留**按月分组**（月份标题不变）。
- 视频**进视野即播**（静音、循环）。
- **去掉**视频右下角角标。

## 1. 现状（事实依据）

- 渲染：`album-timeline → album-month-group（月份标题）→ album-photo-grid` 方形网格。`frontend/src/App.tsx:8254`
- 网格样式：`grid-template-columns: repeat(auto-fill, minmax(96px, 1fr))`；tile 强制 `aspect-ratio: 1 / 1` + `object-fit: cover`（即"豆腐块"成因）。`frontend/src/styles/mobile-app.css:3301`
- 视频缩略：`AlbumVideoThumbnail` 优先显示 `thumbnailUrl` 封面，否则显示 `<video muted playsInline preload="metadata">` 的静止首帧，**无自动播放**。`frontend/src/components/AlbumVideoThumbnail.tsx`
- 数据：`Attachment` 已带可选 `width/height`。新上传素材会写入尺寸（图片读 `naturalWidth/Height`，视频读 `videoWidth/Height`）。`frontend/src/App.tsx:3868`、`frontend/src/types.ts:14`
- 分组：`albumGroups` 已按月分组，组内按 `occurredAt` 倒序（新→旧）。`frontend/src/App.tsx:2969`

## 2. 布局设计：按月分组内的双列瀑布流

保留 `album-timeline → album-month-group（月份标题）` 外层结构。每个月组内，将方形网格替换为**固定双列**瀑布流：

- **tile 高度由真实长宽比决定**：tile 设 `aspect-ratio: w/h`，媒体满铺（`object-fit: cover`，因 tile 比例=媒体比例，视觉上不裁切、不留黑边）。
- **排序（按日期）**：组内条目按日期倒序，采用「**贪心最短列**」依次放入当前更短的一列。效果：顶部恒为最新、两列高度尽量均衡、每列内部严格按日期倒序。
- **实现方式选择**：用 **JS 计算两列分配**，不使用 CSS `column-count`（先填满左列再右列，破坏日期阅读顺序），也不使用实验性 `grid-template-rows: masonry`（Capacitor/WKWebView 支持不稳）。JS 分配顺序正确、可控、可单测。

### 2.1 长宽比来源与防抖

- 优先 `attachment.width / attachment.height`。
- 缺失（老素材、聊天来源）：先以默认 **3:4** 占位参与分列；媒体 `onLoad`（图）/`onLoadedMetadata`（视频）读到真实尺寸后写入一个 `Map<attachmentId, ratio>` 状态并触发重排（一次性，绝大多数素材本就带尺寸，抖动很小）。
- **极端比例夹取**到约 `[0.5, 1.8]`（高/宽比），避免出现超长或超扁的怪 tile；仅极端长图被轻微裁切（可接受）。
- 无 attachment 的占位条目（分类图标）按 1:1 渲染。

### 2.2 列数

固定 2 列（本期不做横屏/平板 3 列）。

## 3. 视频：进入视野即播

将 `AlbumVideoThumbnail` 改为「进视野自动播」组件（沿用文件名或新建 `AlbumVideoTile`）：

- 渲染 `<video muted loop playsInline preload="metadata" poster={thumbnailUrl}>`。
- **不**用 `autoplay` 属性；用 **IntersectionObserver** 控制：可见（阈值约 0.4）→ `play()`；移出 → `pause()`。off-screen 视频不空耗。
- `muted + playsInline + 程序化 play()` 在 iOS WKWebView 可内联播放；`play()` 的 promise 拒绝（如策略限制）需吞掉、回退到静止封面。
- 尊重 `prefers-reduced-motion`：开启时不自动播，只显示封面/首帧。
- 点击仍走现有全屏预览（带声音），预览逻辑不动。
- **去掉**右下角 `album-video-badge`。

### 3.1 性能注记

用户选择"进视野即播"，故双列下同屏可能多个视频同时播放（静音）。本期不限制并发数；如真机出现耗电/卡顿，后续可改为「只播最居中一个」或共享单个 IntersectionObserver。

## 4. 改动文件

| 文件 | 改动 |
| --- | --- |
| `frontend/src/albumDomain.ts` | 新增纯函数 `attachmentAspectRatio(attachment, fallback)`（含夹取）与 `distributeIntoColumns(items, columnCount, ratioOf)`（贪心最短列、保序）。可单测。 |
| `frontend/src/App.tsx` | 月组内由方形网格改为双列瀑布流渲染；引入 `Map<id, ratio>` 测量状态与 onLoad 回填；为每个 tile 设 `aspect-ratio`。`App.tsx:8254` 附近。 |
| `frontend/src/components/AlbumVideoThumbnail.tsx` | 改为 IntersectionObserver 驱动的自动播放视频组件（静音/循环/playsInline、reduced-motion 回退、play() 容错）。 |
| `frontend/src/styles/mobile-app.css` | 替换 `.album-photo-grid` / `.album-photo-thumb` 的方形样式为：双列容器（两列 flex/grid + gap）、tile 走 `aspect-ratio` 变量、`object-fit: cover`；移除角标样式引用。`mobile-app.css:3301`。 |

## 5. 测试与验收

- **单测**（`distributeIntoColumns`、`attachmentAspectRatio`）：
  - 列内按日期保序；顶部为最新。
  - 缺尺寸用默认比例；极端比例被夹取。
  - 两列高度大致均衡（贪心结果可断言列高差 ≤ 单个最大 tile 高）。
- **实机/截图验收**：
  - 瀑布流双列、按月分组、组内新→旧；图片/视频不裁切、无黑边。
  - 视频进视野静音自动播放、划走暂停；点击进全屏（带声音）。
  - 老素材（无尺寸）加载后比例正确、抖动可接受。
  - `prefers-reduced-motion` 下不自动播。
  - 无视频角标。

## 6. 不在本期范围（YAGNI）

- 横屏/平板多列自适应。
- 视频并发播放上限 / 共享 observer 优化。
- 不分月的整页连续瀑布流（已确认保留按月分组）。
- 单列信息流 / Google 相册式自适应行（已选瀑布流）。
