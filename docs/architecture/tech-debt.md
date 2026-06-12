# 架构债登记册(Tech Debt Register)

> 更新:2026-06-12(代码结构 review 新增 D10–D13,设计依据见 [cross-platform-principles.md](cross-platform-principles.md);此前 P1/P2 批次 D3/D4/D5/D8 见 perf-p1p2-report,P0 见 perf-p0-report)· 来源:2026-06-10 ~ 06-12 排障复盘 + 结构 review
> 读者:后续在本仓库工作的所有 agent 与开发者
> 用法:**动手前先查本文**——「不变量」一节是红线,「已修复存档」避免重复排查,「债项清单」按优先级取活。行号会漂移,定位一律用文中的 grep 锚点。

---

## 0. 一页结论

| # | 债项 | 影响面 | 优先级 | 状态 |
|---|------|--------|--------|------|
| D1 | App.tsx 上帝类(9690 行 / 185 函数 / 226 hooks / 全 Tab 一棵树) | 全局性能、可维护性 | **P0** | **阶段一完成**(AlbumScreen 已拆,守卫测试 [M];余 Records/Profile,目标结构见 [cross-platform-principles.md](cross-platform-principles.md) §3) |
| D2 | ~~服务端缩略图缺失~~ 实为:app/state 读放大 + 视频封面缺失 | 状态接口延迟、相册 | **P0** | **完成**(2026-06-12,见报告;原"图片缺缩略图"前提经生产实查证伪) |
| D3 | 长列表无 DOM 虚拟化(相册/聊天/照护记录) | 滚动性能、内存 | P1 | **相册完成**(2026-06-12,tile 视口窗口化;聊天/记录列表待 D1 拆 RecordsScreen 后做) |
| D4 | 媒体 objectURL 会话内永不释放 + 网格首挂 IDB 事务风暴 | 内存、相册首开 | P1 | **完成**(2026-06-12,LRU 释放 + 单事务批量预查) |
| D5 | 全局裸元素 CSS reset 渗透第三方组件 | 任何引入第三方 UI 的场景 | P1 | **完成**(2026-06-12,审计归零,资产规则见 D5 详情) |
| D6 | 服务端状态与 UI 状态混杂(无分层) | 可维护性 | P1 | 随 D1 一起还(D1 剩余 Records/Profile 拆分时同步抽 hooks,本批未动) |
| D7 | 共享 SQLite(主服务 + admin 同库) | 规模化 | P2 | WAL+busy_timeout 已配,带触发条件(2026-06-12 复核:触发条件均未满足,不动) |
| D8 | 测试盲区:DOM 级测试只覆盖相册预览 | 回归风险 | P2 | **完成**(2026-06-12,核心三链路齐:聊天[N]/记录[O]/相册 gesture 套件) |
| D9 | OSS 签名 URL 轮换 vs 一切缓存层 | 缓存正确性 | 设计约束 | 已解,须遵守 |
| D10 | FE/BE 契约零防护网(无 codegen + 无运行时校验) | 稳定性(后端改字段→前端白屏且查不到) | **P1** | 未开工(2026-06-12 review 新发现,最高 ROI) |
| D11 | 原生端口层泄漏(App.tsx 裸调 Capacitor 12 处) | Web↔原生边界 | P2 | 未开工(封装模块已存在,只是被绕过) |
| D12 | 模块分类法不清(components/ 与 views/ 边界含糊) | 可维护性 | P2 | 未开工(随 D1 拆分归位) |
| D13 | 记录类型散弹式分支(~39 处 kind 判断,违反 OCP) | 扩展性(加记录类型=改多处) | P1 | 未开工(注册表化,动 records 时顺带) |

**平台决策(2026-06-12,与用户对齐)**:不上 React Native、不做原生相册。所有已知卡顿均为应用层架构问题(见 §3),换平台不解决。复议条件:打完 D2+D3 后,千元安卓机相册滚动仍 <55fps 或冷启动仍 >2s,才考虑「仅原生化全屏查看器」(绝不原生化网格——滚动同步/双缓存/失去 OTA,代价最高收益最低)。

---

## 1. 债项清单(现状 / 证据 / 方案 / 验收)

### D1【P0】App.tsx 单体组件

- **现状**:`frontend/src/App.tsx` ~9800 行,98 个 `useState`,四个 Tab 的全部 JSX 在同一组件树里。任何一个 setState 都重渲染整棵树。
- **证据锚点**:`grep -c useState frontend/src/App.tsx`;Tab 显隐机制 `grep -n "mobile-tab-" frontend/src/styles/mobile-app.css`(CSS 切换,DOM 常驻)。
- **已落地的缓解**(2026-06-11,commit `0188b29`):
  - 未访问 Tab 不渲染:`grep -n visitedMobileTabsRef frontend/src/App.tsx`;
  - 相册 timeline key 恒定(此前每次进相册整网格销毁重建):`grep -n '"album-timeline"' frontend/src/App.tsx`;
  - 老照片宽高比 onLoad 合批 160ms(此前逐张整树重渲染):`grep -n pendingAlbumRatiosRef frontend/src/App.tsx`。
- **剩余债**:访问过的 Tab 仍随任意 setState 重渲染;文件过大导致行号漂移、编辑锚点失效、TS 增量编译慢。
- **方案(渐进,绝不大爆炸)**:按 Tab 拆 memo 组件,**照 `LedgerView` 的既有模式**(它已是 props 显式化的独立组件,`grep -n "<LedgerView" frontend/src/App.tsx`):
  1. `AlbumScreen`(最大收益,媒体最重)→ 2. `ProfileScreen` + `RemindersScreen` → 3. `RecordsScreen`(最复杂,最后拆);
  4. 每块拆出时同步抽领域 hook(见 D6),props 显式传入,`React.memo` 包裹;
  5. **每拆一块就跑 `npm run verify:frontend` 并提交一次**,不积攒。
- **验收**:React DevTools Profiler 下,切 Tab / 聊天输入时,非活动 Tab 组件 0 render;App.tsx 降到 <3000 行。

### D2【P0,已完成 2026-06-12】~~服务端缩略图缺失~~ → 实为读放大 + 视频封面

- **前提证伪**(生产只读实查):132 张图片 0 缺缩略图——上传生成 + `ensureThumbnail` 懒回填一直健康,"老照片网格解码原图"不成立。**经验:债项登记前先拿生产数据验证假设。**
- **实际修复**(commit `523d503`,详见 docs/verification/perf-p0-report-2026-06-12.md):
  1. **app/state 读放大**:每次水合对每个附件 ensureThumbnail→OSS HEAD(132×每次读取)。已加进程内 verified 缓存 + 生成失败 1h 节流(`grep -n thumbnailVerifiedIds backend/src/main/java/com/xiaobao/babycompanion/service/AttachmentStorageService.java`)。
  2. **视频封面自愈**:`POST /api/uploads/{id}/poster`(幂等/仅看护人/不覆盖),客户端播无封面视频抽帧回传(`grep -n setVideoPosterUploader frontend/src/mediaCache.ts`,实现在 posterUpload.ts)。8 个存量缺封面视频随浏览自动痊愈。
- **附带规则**:被 esbuild 逻辑测试打包的模块(albumDomain/mediaCache 等)不得引入资产文件或 `import.meta.env` 依赖——需要时用注入(参见 posterUpload.ts / components/albumIcons.ts)。

### D3【P1,相册已完成 2026-06-12】长列表无 DOM 虚拟化

- **已落地(相册)**:tile 视口窗口化(`grep -n AlbumPhotoTile frontend/src/components/AlbumScreen.tsx`):tile 壳(article+button)常驻保布局/点击目标,媒体子树进滚动容器 ±150%(约两屏)才挂、离开即卸(`grep -n observeViewportWindow frontend/src/components/albumVideoPlayback.ts`);首组每列前 8 个 tile 首帧即挂(首屏不等观察器)。600 项数据集实测:首开挂载媒体元素 600 → 26,滚动 8 屏后稳定在 ~52(见 perf-p1p2 报告)。
- **排查沉淀(重要)**:IntersectionObserver `root: null`(视口)时,目标会先被**内层 overflow 滚动容器裁剪**,`rootMargin` 形同虚设——相册的滚动容器是 `.album-screen` 而非视口,余量从未生效(视频近视口挂载的 320px 同样)。现按「目标最近可滚动祖先」解析 root、按 root 建观察器。**今后任何基于 IO 的预挂载都必须传对 root。**
- **剩余**:聊天消息列表、照护记录列表仍全量 DOM,依赖 D1 拆出 RecordsScreen 后再做(倒序 + 锚定底部,注意键盘弹起场景)。
- **验收(相册部分,已达)**:挂载媒体元素数 ≤ 可视区 ±2 屏;gesture 套件 + 冒烟全绿。千元安卓 ≥55fps 待真机复核。

### D4【P1,已完成 2026-06-12】媒体内存生命周期 + IDB 事务风暴

- **已落地**(`frontend/src/mediaCache.ts`):
  - **objectURL LRU 上限**:映射 >200 条时 revoke「最旧、不在 DOM、静置 ≥30s」的条目(`grep -n planObjectUrlEviction frontend/src/mediaCache.ts`,纯函数有单测);被释放的条目下次从 IndexedDB 重建,功能无感。配合 D3 的出窗卸载,长会话浏览大相册内存有界。
  - **批量预查**:`preloadLocalMediaUrls`(单只读事务批 get,绝不触网)在相册数据就绪时灌首屏 32 项进内存映射(`grep -n preloadLocalMediaUrls frontend/src/components/AlbumScreen.tsx`);后续 tile 进窗按需单查。首挂并发 IDB 事务从 O(全部 tile) 降到 O(可视窗口)。
- **注意**:revoke 只挑「不在 DOM」的 URL(查 `img[src]/video[src]/video[poster]/source[src]`);30s 静置保护期防「解析出 URL 尚未挂进 DOM 即被回收」的竞态。
- **验收**:planObjectUrlEviction 单测全绿(test:media-cache);「500 张 30 分钟内存曲线平稳」待真机长测复核。

### D5【P1】全局裸元素 CSS reset 渗透第三方组件

- **现状**:全局样式存在 `video { max-width:100% }` 一类**裸元素选择器**,会穿进第三方组件内部。
- **已发生的事故**(都修了,引以为戒):
  1. PhotoSwipe 视频被 `max-width:100%` 相对宽 0 的容器**钳成 0 宽 → 全屏黑屏**(修复:`.pswp-video { max-width:none }`,commit `cfaca66`);
  2. admin 后台 `.card { display:grid }` 声明顺序覆盖 `[hidden]{display:none}` → 登录框关不掉;相册 ⋯ 菜单灰框常驻同根因(popover 的 display 规则覆盖 hidden 属性,commit `520bc28`)。
- **已落地(2026-06-12,审计归零)**:`frontend/src/styles/*.css` 全部裸元素选择器(button/a/label/summary/nav/input/select/textarea/h1-h3/p/img/video/canvas)收紧为 `:where(#root, .app-portal) <元素>`——`:where()` 零特异性,**级联与改前完全一致**,只是不再命中应用 DOM 之外(PhotoSwipe 等第三方容器)。`html/body/:root/*` 为文档级基础规则,保留为豁免项。
- **配套规则(新增,必须遵守)**:
  1. **portal 到 body 的应用自有弹层必须带 `.app-portal` 类**(现有:records-entry-scrim、voice-recording-panel),否则拿不到全局 reset;
  2. 第三方容器内需要本站观感时,在其专属样式里显式声明(参照 pswp-album.css 给关闭/菜单按钮补回的点按反馈),不依赖全局渗透;
  3. 显隐一律用 class(`.is-open`/`.hidden` + 明确的 display 默认值),绝不依赖 `hidden` 属性对抗 class 规则。
- **验收(已达)**:审计 grep 归零(`grep -nE "^(img|video|button|input|ul|li|a|p|h[1-6]) *[,{]" frontend/src/styles/*.css` 仅余 html/body 豁免);gesture [I]/[J] 常绿;smoke 多视口布局检查全绿。

### D6【P1】状态分层缺失

- **现状**:服务端状态(`/api/app/state` 全量)与 UI 瞬时状态混在 98 个 useState 里;`LedgerView` 要钻 20+ 个 props。
- **方案**:随 D1 拆分**同步**抽领域 hooks:`useAlbumState` / `useLedgerState` / `useCareLogState`…(数据 + 操作封装在一起,组件只拿自己那份)。**beta 阶段不引状态库**(zustand/jotai 等),拆完单体后如 props 钻探仍痛再评估。
- **2026-06-12 批次说明**:本轮 P1/P2 还债未动 D6——它与 D1 剩余阶段(Records/Profile 拆分)是同一改动面,单独抽 hooks 会让 D1 拆分二次返工,维持「随 D1 一起还」。
- **验收**:每个 Screen 组件 props ≤ 8 个;领域逻辑可单测。

### D7【P2】共享 SQLite(主服务 + admin)

- **现状**:Spring Boot 主服务与 Node admin(better-sqlite3)共享同一 SQLite 文件,WAL + busy_timeout 已配,内测体量(个位数家庭)安全。
- **触发条件**(满足任一才动):并发家庭 >100 / 出现 `SQLITE_BUSY` 报错 / 需要多实例部署。届时迁 MySQL(ECS 已有运维基础),admin 改走主服务的内部 API 而非直连库。
- **2026-06-12 复核**:内测仍为个位数家庭、无 `SQLITE_BUSY` 报告、单实例部署——三个触发条件均未满足,按既定决策不动(P2 还债批次明确跳过,非遗漏)。

### D8【P2,已完成 2026-06-12】测试盲区

- **已落地**:`scripts/test-core-flows.mjs`(纳入 `verify:frontend`,沿 gesture 套件 mock 模式):
  - **[N] 聊天发送主链路**:AI 助手抽屉 composer 输入 → 发送 → mock SSE 流(`/api/agent/chat/stream`)→ 家长消息与 AI 回复均出现在对话线程 → 消息持久化到 `/api/app/state/messages/*`;
  - **[O] 记录创建主链路**:手动记录抽屉 → 选 150ml → 保存 → `/api/app/state/careLogs/*` 收到含 milk 事件的 careLog → 当日时间线显示 150ml。
  - 注:移动端主聊天面板 `display:none`,真实聊天入口就是 records 助手抽屉,[N] 测的就是用户实际路径。
- **剩余(降级为观察项)**:帧率/性能预算门禁未设;`scripts/perf-benchmark.mjs` 已输出 `album_scroll_longtasks`/`blocked_ms` 与挂载媒体数,可在需要时设阈值接入 CI。
- **验收(已达)**:核心三链路(聊天[N]/记录[O]/相册 gesture [A]-[M])都有 DOM 级最小回归;verify:frontend 全套 ~3 分钟。

### D9【设计约束】OSS 签名 URL 轮换 vs 缓存

- **事实**:OSS 签名 URL 的 `Expires/Signature` 每次请求都变,**同一资源 URL 永不相等**。任何以完整 URL 为 key 的缓存(HTTP 缓存、IndexedDB、内存映射)都会 100% miss。
- **既有解法**:`stableMediaKey`(剥离签名参数,`grep -n stableMediaKey frontend/src/mediaCache.ts`)。
- **红线**:今后**任何新缓存层(含 Service Worker、原生层)必须用签名剥离后的 key**;反之,鉴权迁移到 Header/Cookie 前,不要给媒体 URL 加新的易变参数。

> **D10–D13 来自 2026-06-12 代码结构 review**(避免上帝类 / 高扩展 / 低耦合)。设计依据与目标结构见 [cross-platform-principles.md](cross-platform-principles.md);此处只列可执行债。

### D10【P1,未开工】FE/BE 契约零防护网

- **现状**:后端无 OpenAPI(`grep -c "springdoc\|swagger" backend/pom.xml` = 0),前端无 zod 等运行时校验;`frontend/src/types.ts`(459 行)手抄后端 DTO,`/api/app/state` 响应 `JSON.parse` 后直接 `as` 强转。后端改字段名/删字段 → 前端**静默拿到 undefined 运行时炸,且 mock 测试永远发现不了**。
- **方案(最小、零依赖、最高 ROI)**:整个 App 从 `/api/app/state` 一个响应水合——在 `appStateApi.ts` 水合点加一个**手写校验器**(~80 行,不引 zod),响应缺关键字段时走现成 `reportClientError` 上报(kind 如 `state_contract_drift`),并安全降级而非整页崩。
- **不做(scale 触发)**:全量 OpenAPI codegen——契约稳定时收益低、维护贵;等"契约频繁变 / 多人协作 / 接第二客户端"任一触发再上。
- **验收**:故意给 mock 删一个关键字段,前端不白屏且产生一条 contract_drift 上报。

### D11【P2,未开工】原生端口层泄漏

- **现状**:已有 6 个原生封装(nativeAlarm/nativeMediaPicker/mobileUpdates/haptics/audioPermission/errorReporting),**但 App.tsx 仍裸调 Capacitor 12 处**(`grep -n "Capacitor\." frontend/src/App.tsx`):通知渠道(1294/1334/1443 应进 nativeAlarm)、OTA 判断(3288 应进 mobileUpdates)、平台标签(1198/2341 应做成 `platform.ts`)。封装存在却被绕过 = 端口层不是唯一出入口。
- **方案**:把这 12 处下沉到对应封装 / 新建 `platform.ts`,App 只调封装、不直接 import `@capacitor/core`。纯机械搬运。
- **验收**:`grep -c "Capacitor\." frontend/src/App.tsx` = 0;原生差异全部在 `platform/` 与 6 个封装内。

### D12【P2,未开工】模块分类法不清

- **现状**:`components/`(含 AlbumScreen 整屏)与 `views/`(GrowthEntry/Ledger/Milestones 也是整屏)边界含糊,无规则。
- **方案**:定一条规则——**整屏进 `features/<x>/` 或 `screens/`,`components/` 只放跨功能可复用件**;随 D1 拆分时归位,不单独开工。
- **验收**:每个 UI 文件能按规则唯一定位;新人/agent 不靠记忆找文件。

### D13【P1,未开工】记录类型散弹式分支(违反 OCP)

- **现状**:`grep -c 'kind === "' frontend/src/App.tsx` ~39 处 kind 分支(含记录类型/附件类型);加一种记录类型(用药/体温…)要在多处 `if/switch` 逐个加 case,加 AI 模型要改内联 `resolveAgentModelForMessage`(App.tsx:2110)。
- **方案(扩展性最高 ROI)**:记录类型提成数据表 `recordTypes.ts`(`RECORD_TYPES: Record<RecordKind, RecordTypeDef>`,含 label/icon/fields/toTimelineText/toAlbumCategory),分支塌缩为查表;AI 模型路由换策略表 `MODEL_POLICIES`。**加功能 = 加一条数据,不改分发逻辑**。代码骨架见 cross-platform-principles.md §4。
- **时机**:动 records 拆分(D1)时顺带,避免二次穿行万行文件。
- **验收**:新增一种记录类型只改 `recordTypes.ts` 一处;原 kind 分支点降到个位数。

---

## 2. 不变量(改相册/预览/全局样式前必读,违反即测试红)

绑定测试:`scripts/test-preview-gestures.mjs`(纳入 `npm run verify:frontend`)。**这些规则每条背后都是一次线上事故,不要"顺手优化"掉:**

| 不变量 | 背后事故 | 守护测试 |
|---|---|---|
| 相册打开动画**绝不**用 `document.startViewTransition`(用 PhotoSwipe 自带 zoom morph) | Chrome 在 VT 播放期间丢弃全部输入;Android WebView 的 open-VT 挂起 = 整页永久卡死 | [F] |
| 预览视频元素**绝不设 `autoplay`**,播放只由 `contentActivate` 触发;`contentDestroy` 须停播+卸 src | PhotoSwipe 预加载相邻 slide,带 autoplay 的视频后台带声自播 | [L] |
| 自定义视频内容必须调 `content.onLoaded()` | 占位层永远盖在视频上 = 黑屏 | [I] |
| `.pswp-video` 必须 `max-width/max-height: none` | 全局 reset 把视频钳成 0 宽 = 黑屏 | [I] |
| PhotoSwipe `spacing` 必须为 0 | 默认 0.1 = 滑动时相邻图间的黑边条 | [K] |
| 顶栏按钮**绝不加 `backdrop-filter`** | 横滑时逐帧重采样身后图像,直接掉帧 | (人工,见 §3) |
| 相册 timeline 的 React key 必须稳定(不许用递增 seed 重放入场动画) | 每次进相册整网格销毁重建 = 巨卡 | (人工) |
| 弹层显隐用 `.is-open` class,不依赖 `hidden` 属性 | display 类规则覆盖 [hidden] = 灰框常驻、点击死区 | [J] |
| popover 不得嵌进 `<button>` 内部 | button 套 button = 内层点击不可靠 | [J] |
| `CachedImg` 取源:内存命中→本地;否则 IDB 与 50ms 赛跑,**源一旦确定不再切换** | 换源重解码闪旧帧;锁死又导致杀进程后缓存失效(两边都踩过) | [G] |
| 预览打开时挂起网格视频(`suspendAlbumVideos`),销毁时恢复 | 被遮挡的网格视频继续解码,拖低滑动帧率 | (人工) |
| 网格 `<video>` 接近视口(±320px)才挂载 | N 路解码器并发初始化 = 相册首开卡 | (人工) |
| OTA 构建必须注入生产 API base URL 并 grep 验证 | 见 `AGENTS.md`「Cloud And Data Safety」,2026-06-05 全量 load failed 事故 | 构建脚本硬校验 |

gesture 套件场景速查:[A] 反复开关不卡死 · [B] 连续快翻恰好 +N · [D] 反向翻页 · [E] 收尾可交互 · [F] 慢网+瀑布流未就绪立即点开不卡死 · [G] reload 后已浏览图片零网络 · [H] 无尺寸老照片不变正方形 · [I] 视频 slide 占位层移除+铺开 · [J] 顶栏关闭/菜单可用 · [K] 相邻 slide 无缝 · [L] 预加载/划过视频绝不自播。

---

## 3. 已修复存档(2026-06-10 ~ 06-12,不要重复排查)

按时间线,均已验证并发布 OTA:

| Commit | 修复 |
|---|---|
| `f596bed` | 手搓滑动数学抽纯函数 + 13 条单测(残余位移 2%~98% 窗口) |
| `468fa79` | 三根因:VT 吞输入(打开改 FLIP)/ 翻页未落账吞滑 / transition 同帧写入不播(强制 reflow);建 DOM gesture 测试 |
| `26635ef` | CachedImg 锁源导致杀进程后缓存失效 → 50ms IDB 赛跑;[F][G] 场景 |
| `79dc0cd` | **预览整体替换为 PhotoSwipe 5**;手搓版存档于 tag `archive/handcrafted-preview`;close-during-opening 补丁(pswp 在打开动画中忽略 close → 挂 openingAnimationEnd 补执行) |
| `52e0576` | 无尺寸老照片正方形(比例兜底+updateContentSize)/ 视频定位 / 全屏纯黑还原 |
| `cfaca66` | 视频黑屏双根因(onLoaded 缺失 + 全局 max-width 钳制)/ 顶栏 × 左 ⋯ 右还原 |
| `520bc28` | 塑料关闭按钮(自带 icn-shadow)→ 自定义干净按钮;菜单灰框常驻([hidden] 被覆盖)+ button 嵌套死区 |
| `352c016` | 黑边间隔(spacing:0)/ 顶栏按钮 backdrop-filter 掉帧 |
| `89db94a` | 预览视频 autoplay 后台漏音根除 / 预览期挂起网格视频 / Android muted 四重强制 |
| `0188b29` | 渲染五连修:visited-tab 懒渲染 / 相册不再整体重挂载 / ratio 合批 / 视频近视口挂载 / content-visibility |

诊断方法论沉淀:体感问题(卡/闪/吞)优先写 **DOM 级 Playwright 复现测试**(真浏览器+真组件+mock API),红了再修,修绿后纳入 verify——本战役 11 个场景全部由此而来,多次推翻了错误假设(如「滑动卡」最初归因图片解码,实测是 backdrop-filter;「漏音」最初疑网格,实测是预览 autoplay)。

---

## 4. 还债路线图(建议顺序)

1. ~~**D2 服务端缩略图**~~(完成,2026-06-12)
2. ~~**D1 拆 AlbumScreen**~~(完成,2026-06-12)
3. ~~**D3 相册虚拟化** + **D4 内存生命周期**~~(完成,2026-06-12,见 perf-p1p2 报告)
4. D1 余下部分(Profile → Records)+ D6 领域 hooks ← **下一步**
5. ~~D5 CSS 审计~~(完成,2026-06-12,审计归零 + app-portal 规则)
6. ~~D8 测试补盲~~(完成,2026-06-12,[N]/[O] 入 verify)+ D3 聊天/记录列表窗口化随 4 一起
7. 达到量化线后复评平台决策(§0)

每步完成的定义:`npm run verify:frontend` 全绿 + 真机体感验证 + 本文对应条目更新状态。
