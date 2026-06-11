# 架构债登记册(Tech Debt Register)

> 更新:2026-06-12(P0 完成,见 docs/verification/perf-p0-report-2026-06-12.md)· 来源:2026-06-10 ~ 06-12 排障复盘
> 读者:后续在本仓库工作的所有 agent 与开发者
> 用法:**动手前先查本文**——「不变量」一节是红线,「已修复存档」避免重复排查,「债项清单」按优先级取活。行号会漂移,定位一律用文中的 grep 锚点。

---

## 0. 一页结论

| # | 债项 | 影响面 | 优先级 | 状态 |
|---|------|--------|--------|------|
| D1 | App.tsx 单体组件(~9800 行 / 98 useState / 全 Tab 一棵树) | 全局性能、可维护性 | **P0** | **阶段一完成**(AlbumScreen 已拆,守卫测试 [M];余 Records/Profile,见报告) |
| D2 | ~~服务端缩略图缺失~~ 实为:app/state 读放大 + 视频封面缺失 | 状态接口延迟、相册 | **P0** | **完成**(2026-06-12,见报告;原"图片缺缩略图"前提经生产实查证伪) |
| D3 | 长列表无 DOM 虚拟化(相册/聊天/照护记录) | 滚动性能、内存 | P1 | 仅做了 content-visibility |
| D4 | 媒体 objectURL 会话内永不释放 + 网格首挂 IDB 事务风暴 | 内存、相册首开 | P1 | 未开工 |
| D5 | 全局裸元素 CSS reset 渗透第三方组件 | 任何引入第三方 UI 的场景 | P1 | 已两次踩坑,未系统审计 |
| D6 | 服务端状态与 UI 状态混杂(无分层) | 可维护性 | P1 | 随 D1 一起还 |
| D7 | 共享 SQLite(主服务 + admin 同库) | 规模化 | P2 | WAL+busy_timeout 已配,带触发条件 |
| D8 | 测试盲区:DOM 级测试只覆盖相册预览 | 回归风险 | P2 | gesture 套件 [A]-[L] 已建 |
| D9 | OSS 签名 URL 轮换 vs 一切缓存层 | 缓存正确性 | 设计约束 | 已解,须遵守 |

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

### D3【P1】长列表无 DOM 虚拟化

- **现状**:相册瀑布流、聊天消息列表、照护记录列表都是全量 DOM。已加 `content-visibility: auto`(`grep -n content-visibility frontend/src/styles/mobile-app.css`)只跳过离屏 paint/layout,**DOM 节点与 React 协调成本还在**。
- **方案**:相册优先。自研窗口化(masonry 列高已知,`distributeIntoColumns` + `albumTileAspect` 可直接算每 tile 位置)或引 `@tanstack/react-virtual`。聊天列表次之(倒序 + 锚定底部,注意键盘弹起场景)。
- **验收**:500 张相册,挂载的 tile DOM 数 ≤ 可视区 ±2 屏;千元安卓滚动 ≥55fps。
- **前置**:依赖 D1 把 AlbumScreen 拆出来再做,否则改动面积失控。

### D4【P1】媒体内存生命周期 + IDB 事务风暴

- **现状**:
  - `mediaCache.ts` 的内存映射(`getMemoizedLocalUrl`)中的 objectURL **整个会话不 revoke**,大相册长会话内存只增不减;
  - 网格首挂时每个 tile 各自发起 `getLocalMediaUrl`(50ms 限时赛跑,`grep -n "50" frontend/src/components/CachedMedia.tsx`),几百 tile = 几百个并发 IDB 事务。
- **方案**:
  - objectURL 引用计数或 LRU 上限(如内存映射 >200 条时 revoke 最旧且当前不在 DOM 的);
  - 网格首挂改批量预查:一次 IDB `getAll`(或按 key 批查)灌满内存映射后再渲染网格,tile 命中内存同步出图。
- **验收**:浏览 500 张相册 30 分钟,WebView 内存曲线平稳;相册首开 IDB 事务数从 O(n) 降到 O(1)。

### D5【P1】全局裸元素 CSS reset 渗透第三方组件

- **现状**:全局样式存在 `video { max-width:100% }` 一类**裸元素选择器**,会穿进第三方组件内部。
- **已发生的事故**(都修了,引以为戒):
  1. PhotoSwipe 视频被 `max-width:100%` 相对宽 0 的容器**钳成 0 宽 → 全屏黑屏**(修复:`.pswp-video { max-width:none }`,commit `cfaca66`);
  2. admin 后台 `.card { display:grid }` 声明顺序覆盖 `[hidden]{display:none}` → 登录框关不掉;相册 ⋯ 菜单灰框常驻同根因(popover 的 display 规则覆盖 hidden 属性,commit `520bc28`)。
- **方案**:
  - 审计 `frontend/src/styles/*.css` 里所有裸元素选择器(`grep -nE "^(img|video|button|input|ul|li|a|p|h[1-6]) *[,{]" frontend/src/styles/*.css`),逐个收紧为 class 作用域;
  - **规则**:显隐一律用 class(`.is-open`/`.hidden` + 明确的 display 默认值),绝不依赖 `hidden` 属性对抗 class 规则;新引第三方 UI 时先在其容器上显式解除本站 reset。
- **验收**:gesture 套件 [I](视频铺开)/[J](菜单弹层)常绿;审计清单归零。

### D6【P1】状态分层缺失

- **现状**:服务端状态(`/api/app/state` 全量)与 UI 瞬时状态混在 98 个 useState 里;`LedgerView` 要钻 20+ 个 props。
- **方案**:随 D1 拆分**同步**抽领域 hooks:`useAlbumState` / `useLedgerState` / `useCareLogState`…(数据 + 操作封装在一起,组件只拿自己那份)。**beta 阶段不引状态库**(zustand/jotai 等),拆完单体后如 props 钻探仍痛再评估。
- **验收**:每个 Screen 组件 props ≤ 8 个;领域逻辑可单测。

### D7【P2】共享 SQLite(主服务 + admin)

- **现状**:Spring Boot 主服务与 Node admin(better-sqlite3)共享同一 SQLite 文件,WAL + busy_timeout 已配,内测体量(个位数家庭)安全。
- **触发条件**(满足任一才动):并发家庭 >100 / 出现 `SQLITE_BUSY` 报错 / 需要多实例部署。届时迁 MySQL(ECS 已有运维基础),admin 改走主服务的内部 API 而非直连库。

### D8【P2】测试盲区

- **现状**:DOM 级回归只有相册预览 gesture 套件(`scripts/test-preview-gestures.mjs`,场景 [A]-[L],含义见 §2);聊天、记录、账本无 DOM 级测试;无帧率/性能预算门禁。
- **方案**:沿 gesture 套件的 mock 模式(`page.route` + `appState` 注入)给聊天发送/记录创建各写一条主链路冒烟;性能门禁可用 CDP tracing 统计相册滚动 long task 数(>50ms 任务计数)设阈值。
- **验收**:核心三链路(聊天/记录/相册)都有 DOM 级最小回归;verify:frontend 仍 <5 分钟。

### D9【设计约束】OSS 签名 URL 轮换 vs 缓存

- **事实**:OSS 签名 URL 的 `Expires/Signature` 每次请求都变,**同一资源 URL 永不相等**。任何以完整 URL 为 key 的缓存(HTTP 缓存、IndexedDB、内存映射)都会 100% miss。
- **既有解法**:`stableMediaKey`(剥离签名参数,`grep -n stableMediaKey frontend/src/mediaCache.ts`)。
- **红线**:今后**任何新缓存层(含 Service Worker、原生层)必须用签名剥离后的 key**;反之,鉴权迁移到 Header/Cookie 前,不要给媒体 URL 加新的易变参数。

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

1. **D2 服务端缩略图**(后端独立任务,对相册性能立竿见影,不依赖任何拆分)
2. **D1 拆 AlbumScreen**(为 D3 铺路;拆完即做 D4 的批量预查)
3. **D3 相册虚拟化** + **D4 内存生命周期**
4. D1 余下部分(Profile → Records)+ D6 领域 hooks
5. D5 CSS 审计(可与任意阶段并行,小步)
6. D8 测试补盲(每拆一个 Screen 配一条冒烟)
7. 达到量化线后复评平台决策(§0)

每步完成的定义:`npm run verify:frontend` 全绿 + 真机体感验证 + 本文对应条目更新状态。
