# 小宝记功能清单与自动化测试蓝图

## Summary

本文档基于工作区 OpenSpec、前端 React/Capacitor 代码、后端 Spring Boot 代码、Android/iOS 原生插件和现有文档整理。目标是形成一份详细功能清单，后续可据此生成自动化测试脚本，模拟真实用户完成关键路径验证。

本清单同时标注：

- `P0`：核心可用性路径，后续自动化必须覆盖。
- `P1`：重要业务闭环，建议纳入常规回归。
- `P2`：边界、只读、异常、原生设备或运维能力，可分层验证。

## OpenSpec 验证约束

OpenSpec 当前定义了前端交付的基本验证标准。后续自动化脚本应把这些规则固化为默认检查：

- UI、交互、移动布局改动后必须运行前端验证，不能只依赖构建成功。
- 基线命令：`npm run build`，并启动本地应用后用浏览器自动化检查页面。
- 移动视口矩阵：`375x667`、`390x844`、`430x932`、`360x800`、`412x915`、`432x960`。
- 视觉检查项：白屏、控制台错误、文本重叠、横向溢出、控件裁切、固定底栏遮挡、主操作不可达。
- 表单、输入区、弹层、抽屉等键盘敏感 UI 需要模拟输入聚焦和键盘收起后的布局。
- 原生相关改动需要升级验证：`npm run mobile:sync`、`npm run build:android:debug`、`npm run build:ios:debug`，并说明真机剩余风险。

## 用户角色与共享边界

### 角色

- 已登录家庭成员：可读取家庭共享数据。
- 照护人：可聊天、上传、记录、确认待办、编辑资料、创建/完成/删除提醒、管理相册和账本。
- 仅查看成员：可查看共享资料、照护记录、相册、账本；不可写入或调用 Agent/ASR/上传。

### 家庭共享数据

- 小宝资料 `profile`
- 成长事件 `growthEvents`
- 成长测量数据 `growthMeasurements`
- 照护日志 `careLogs`
- 相册项 `albumItems`
- 账本支出 `expenses`
- 附件文件按 `family_id` 校验，同家庭成员可查看。

### 账号私有数据

- 聊天消息 `messages`
- 提醒 `reminders`
- AI 记忆 `memories`
- 待确认效果 `pendingEffects`
- 会话摘要 `conversationSummary`

## 功能清单

### 1. 应用壳、导航与运行环境

| 优先级 | 功能 | 当前实现 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 移动底部导航 | `聊天 / 记录 / 账本 / 相册 / 提醒 / 我的` 六个 Tab；仅查看成员隐藏聊天入口。 | 浏览器模拟登录后切换所有 Tab，断言对应 `aria-label` 页面出现；仅查看账号断言聊天 Tab 不出现。 |
| P0 | 固定移动视口 | App 使用固定壳和底部导航，避免页面整体横纵向拖动。 | 视口矩阵下检查 `document.scrollingElement.scrollWidth <= innerWidth`，关键页面无横向溢出。 |
| P1 | 右侧/左侧桌面辅助栏 | 桌面宽屏显示资料、记忆、时间线、提醒追踪和安全提示。 | 桌面视口下断言辅助栏存在，移动视口下核心内容不被遮挡。 |
| P1 | OTA 更新 | 原生端启动后调用 `/api/mobile-updates/check`，下载并切换 Capgo bundle。 | Web 层 mock 更新接口，断言更新提示事件；原生构建验证插件可用。 |
| P2 | 运行版本信息 | 我的页展示 OTA 版本、平台、原生版本和后端接口。 | 登录后进入我的页，断言运行信息字段渲染。 |

### 2. 登录、家庭与首次设置

| 优先级 | 功能 | 当前实现 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 手机号 + 家庭邀请码登录 | `POST /api/auth/login`，返回 token、user、family、member、onboardingRequired。 | API 测试新手机号登录；Web 表单输入手机号/邀请码后完成登录。 |
| P0 | 已注册用户再次登录 | 邀请码达到 6 位后调用 `/api/auth/invite/roles?inviteCode&phone`；若是已有成员，登录页不再要求角色/照护人选择。 | 用已绑定手机号进入登录页，断言出现“已识别家庭身份”，角色选择区域不出现。 |
| P0 | 新成员选择身份与权限 | 新手机号必须选择角色和是否照护人；核心角色爸爸/妈妈/爷爷/奶奶/外公/外婆同家庭唯一。 | 新手机号不选角色提交失败；选择已占用核心角色失败；月嫂/亲友可重复。 |
| P1 | 角色预检 | `GET /api/auth/invite/roles` 返回家庭名、占用角色、已有成员身份，不暴露手机号列表。 | API 断言占用角色、repeatableRoles、existingMember。 |
| P1 | 首次小宝资料设置 | 照护人首次进入三步设置：昵称/家庭名/阶段日期、地区/喂养方式、过敏信息。 | 新家庭照护人登录后完成三步，断言进入聊天页、家庭名保存。 |
| P1 | 非照护人等待设置 | 若家庭无完整资料，非照护人看到等待照护人设置页。 | 只读新成员加入空家庭，断言不能进入资料设置表单。 |
| P1 | 家庭名称默认值 | 首位照护人设置小宝昵称时，家庭名默认建议为“小宝名字 + 家”，可修改。 | 输入昵称后检查家庭名自动建议；手动改名后保存。 |
| P2 | 退出登录 | `POST /api/auth/logout` 撤销当前 session 并清本地 token。 | 点击退出后回到登录页；旧 token 访问 `/api/app/state` 返回 401。 |

### 3. 后端状态、权限与持久化

| 优先级 | 功能 | 当前实现 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 状态读取 | `GET /api/app/state` 返回家庭共享 + 当前账号私有的合并视图。 | A/B 同家庭：B 可读 A 的照护记录/相册/账本，不可读 A 聊天/提醒/记忆。 |
| P0 | 写权限拦截 | 写状态、上传、Agent、ASR 均要求照护人。 | 仅查看 token 调用写接口、Agent、上传，断言 403 和只读文案。 |
| P0 | 单条记录 upsert/delete | `PUT /api/app/state/{collection}/{id}`、`DELETE` 支持 profile/messages/growthEvents/growthMeasurements/care/reminder/memory/pending/album/expenses/summary。 | API 逐集合写入/读取/删除，断言共享或私有边界正确。 |
| P1 | 照护日志按日期合并 | `careLogs` 按日期 merge，events/notes/solids 去重；replace 模式用于快照回滚。 | 同一天多次写奶量/睡眠，断言统计合并；replace 后旧事件不残留。 |
| P1 | 待确认确认/丢弃 | `pendingEffects` 当前账号私有；确认后照护/成长/账本进入家庭共享，提醒/记忆进入账号私有。 | A 生成待确认，B 不可见；A 确认后 B 仅看到共享项。 |
| P1 | SQLite 启动迁移 | 创建家庭/成员/记录/附件/账本表和索引，迁移默认家庭、移除账本旧条码字段。 | 后端集成测试启动空库和旧库样例，断言表和迁移字段。 |

### 4. 聊天与 Agent

| 优先级 | 功能 | 当前实现 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 文本聊天 | 照护人可发送文本，优先使用 `/api/agent/chat/stream`，SSE 返回 planning、retrieving_context、tool、reasoning、content、final。 | Mock SSE 或本地后端模拟，断言用户消息、AI streaming、final 卡片更新。 |
| P0 | 模型选择 | DeepSeek V4 Pro/Flash、Doubao Seed 2.0 Pro/Lite；豆包支持图片、视频、低延迟。 | 切换模型后发送请求，断言 `model` 和可用按钮状态。 |
| P0 | 低延迟开关 | 仅豆包模型可开；请求体传 `lowLatencyEnabled`；后端对豆包请求设置 service tier，默认关闭。 | 豆包模型打开低延迟，拦截请求断言字段；DeepSeek 下按钮禁用。 |
| P0 | Agent 权限 | `AgentController` 调用前要求照护人。 | 只读账号调用 `/api/agent/chat` 返回 403。 |
| P1 | Planner + Runtime | Planner 识别 intent/topics/contextNeeds/web/mediaAction；Runtime 使用家庭共享记录和账号私有聊天/记忆。 | 后端 Agent 单测覆盖记录、提醒、记账、联网、媒体保存意图。 |
| P1 | Skill 渐进披露 | `default-baby-companion` 常驻，`pediatric-care-guide` 按主题/风险/问题披露 sections，纯结构化记录不披露。 | 单测：“今天18:30喝奶120ml”不披露育儿知识；“39度怎么办”披露温度/红旗。 |
| P1 | 联网查询 | Planner 或工具路由识别需要最新/官方/政策/价格时调用 `web_search`，返回 sources。 | Mock WebSearchTool，断言工具活动和来源链接展示。 |
| P1 | 安全边界 | 医疗、用药、疫苗、呼吸、外伤等高风险进入提示或待确认，不做诊断。 | Agent 模拟高烧/用药问题，断言 safetyAlerts 和医生/社区医院提示。 |
| P1 | 会话摘要压缩 | 私有聊天达到阈值后 `/api/agent/conversation-summary/compress` 压缩旧消息。 | 构造超过阈值消息，断言 summary 保存且只覆盖当前用户。 |
| P2 | 失败提示 | 模型 API、解析、工具失败会在 UI 显示温和错误或 tool failed 状态。 | Mock 500/非法 JSON，断言错误提示且不写记录。 |

### 5. 自动记录、待确认与能力边界

| 优先级 | 功能 | 当前实现 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 喂奶完整记录 | 必须有奶量；有时间生成时间线事件；日汇总可更新总览。混合喂养缺奶类型会追问。 | “18:30 喝配方奶120ml”自动记录；“喝了120ml”且混合喂养时 ask。 |
| P0 | 喂奶开始意图不记录 | “开始吃奶/准备喂奶”只追问喝完奶量，不写 careLog。 | Agent 模拟输入，断言 effectDecision mode=ask，`careLogs` 不变。 |
| P0 | 睡眠完整记录 | 必须有时长或可推导时长；“睡着了”追问醒来后时长。 | “9点睡了1小时”记录；“9点睡着了”ask。 |
| P0 | 聊天内撤销/删除边界 | 聊天文本不能直接撤销、删除、修改历史记录；只能提示用卡片撤销或记录页编辑。 | 输入“撤销刚才那条”，断言 ignore/边界文案，不删除数据。 |
| P1 | 自动记录撤销卡片 | 自动记录成功后 AI 消息下显示“已自动记录”卡片，可撤销刚写入的记录快照。 | 自动记录后点撤销，断言对应 careLog 回滚。 |
| P1 | 待确认编辑表单 | 待确认成长、照护、提醒、记忆、账本都有自然表单，不展示 JSON。 | 生成 pending，点击编辑，断言表单字段中文可编辑。 |
| P1 | 多事件拆分与去重 | 同一句多照护行为拆成多个事件；同日期/时间/类型重复合并。 | 输入喝奶+睡眠+便便，断言时间线事件数量和类型；重复模型/规则结果不重复。 |

### 6. 语音输入与 ASR

| 优先级 | 功能 | 当前实现 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 按住说话 | 前端录音，经 `/api/asr/stream` 连接豆包 ASR，实时 partial/final 转文字，松手后自动发送。 | 浏览器 mock MediaRecorder/WebSocket，断言 partial 文本显示、final 触发发送。 |
| P0 | ASR 鉴权 | WebSocket 握手放行，但 start 消息必须带 token；非照护人或未登录返回错误。 | WebSocket 测试无 token/只读 token，断言 `AUTH_REQUIRED/FORBIDDEN`。 |
| P1 | 音频格式 | 后端只支持 16kHz mono `pcm_s16le`，ASR 配置缺失返回明确错误。 | 单测/集成测试 start 参数错误，断言 `ASR_UNSUPPORTED_AUDIO`。 |
| P2 | 原生麦克风权限 | Android `AudioPermissionPlugin`、iOS 权限文案；前端做权限错误提示。 | 真机或模拟器权限拒绝路径，断言 UI 提示。 |

### 7. 图片、视频、附件与媒体预览

| 优先级 | 功能 | 当前实现 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 聊天图片/视频上传 | 豆包模型可上传图片/视频；DeepSeek 下视觉按钮禁用。上传支持进度和附件预览。 | Mock 文件上传，断言按钮状态、进度、消息附件。 |
| P0 | 附件持久化 | 本地模式写入 `data/uploads/yyyy-mm-dd`；OSS 模式 presign 直传后 complete；SQLite 只存元数据。 | API 测试 local 上传；OSS mock/presign 流程测试 complete 元数据。 |
| P1 | 缩略图 | 图片缩略图后端生成 480px 内 JPEG；视频使用前端/原生封面或原图缩略信息。 | 上传图片后读取 `/thumbnail`，断言响应；视频无缩略图时 UI 使用视频占位。 |
| P1 | 媒体预览 | 图片支持全屏预览、滑动相册、缩放拖拽；视频使用系统 controls，播放后关闭预览。 | 浏览器点击图片缩放/拖动；点击视频预览，关闭后弹层消失。 |
| P1 | 家庭附件权限 | `GET /api/uploads/{id}` 和 thumbnail 按当前 `family_id` 校验。 | A 家庭附件 B 家庭 token 请求返回错误。 |
| P2 | 上传限制 | 图片/音频默认 100MB，视频 300MB；支持 jpeg/png/webp/gif/mp4/webm/quicktime/mp3/m4a/wav。 | API 传不支持 MIME 或超限，断言失败。 |

### 8. 记录 Tab

| 优先级 | 功能 | 当前实现 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 今日视图 | 展示成长数、关键点、奶量/睡眠分段条形图、当天时间线。 | 构造当天 careLog/growth，断言图表标签、时间线事件。 |
| P0 | 趋势视图 | 近 7 天奶量和睡眠分开柱状对比，分段代表次数/睡眠段。 | 构造 7 天数据，断言每日柱和平均值。 |
| P0 | 日历视图 | 月历标记有记录日期，点日期查看当天总览和时间线。 | 点击有记录日期，断言标题和事件切换。 |
| P1 | 时间线编辑 | 照护人可编辑 care 事件类型、时间、奶量、睡眠时长、体温、备注，保存联动统计。 | 编辑奶量后断言今日奶量和趋势更新；只读账号无编辑按钮。 |
| P1 | 完成提醒进入事实时间线 | 已完成提醒作为事实事件进入当天时间线。 | 完成提醒后记录页出现提醒事件。 |
| P2 | 空状态 | 无记录日期展示空态，照护人可跳转聊天补充。 | 空日期点击“去补充记录”，断言聊天输入填充。 |

### 9. 成长数据维护

| 优先级 | 功能 | 当前实现 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 成长入口与最新值 | 记录 Tab 的“宝宝成长”卡片展示身高、体重、头围最新值，并可进入成长数据页。 | 构造 growthMeasurements，断言卡片展示三项最新值，点击进入“成长记录”。 |
| P0 | 手动新增成长测量 | 照护人可在成长数据页选择身高/体重/头围，填写数值、日期、备注；前端按类型做范围校验，保存到共享 `growthMeasurements`。 | 输入有效体重保存后断言历史列表新增；输入 999cm 断言提示且不写入。 |
| P1 | 手动删除成长测量 | 照护人可从成长数据页删除历史测量；仅查看成员只读不可删。 | 构造历史体重后点击删除，断言列表和后端 `growthMeasurements` 移除；只读账号无删除按钮。 |
| P1 | 成长测量编辑能力 | 照护人可从成长数据历史行点击编辑，复用顶部表单修改类型、数值、日期和备注；保存后同 id 更新共享 `growthMeasurements`。 | 构造历史身高后点击编辑，修改数值和备注，断言旧值消失、新值成为最新值且后端同 id 更新。 |
| P0 | AI 成长数据待确认 | 聊天中明确给出身高/体重/头围会生成待确认 `growthMeasurement`，确认后写入共享成长数据，不直接落库。 | L2 输入完整三项测量，断言 pendingEffects.growthMeasurements 新增；确认后 `growthMeasurements` 增加。 |
| P1 | 成长数据边界 | 体重缺单位、异常值、同日同类型同值重复维护、聊天修改/删除历史成长数据均不直接写入。 | L2 覆盖单位追问、异常值追问、重复 no-write、聊天改/删边界。 |
| P1 | 成长趋势只读查询 | Agent 可基于已有身高/体重/头围做低焦虑趋势说明，不新增记录或记忆，不做医学诊断。 | 预置多条体重后询问趋势，断言回复引用已有数据且 `growthMeasurements/pendingEffects/memories` 不增长。 |

### 10. 账本 Tab

| 优先级 | 功能 | 当前实现 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 手动记账 | 照护人可新增/编辑商品或用途、金额、分类、日期、商家、备注。 | 打开“记一笔支出”，保存，断言列表和统计增加。 |
| P0 | 家庭共享 | 账本 `expenses` 按家庭共享；只读成员可看不可编辑。 | A 记账，B 同家庭可见；B 无新增/编辑/删除按钮。 |
| P0 | AI 记账待确认 | 聊天输入“给小宝买奶粉花了268”生成待确认支出草稿，确认后入账。 | Agent mock/policy 单测，Web 确认 pending 后断言账本增加。 |
| P1 | 本月视图 | 本月总支出、年度累计、本月分类占比、本月较大支出。 | 构造多分类支出，断言金额汇总和排序。 |
| P1 | 年度视图 | 年度月度柱状图。 | 构造跨月支出，断言 12 个月柱和最大比例。 |
| P1 | 明细视图 | 按日期倒序展示支出，支持编辑和删除。 | 编辑金额后统计更新；删除弹二次确认并移除。 |
| P2 | 条码/商品查询 | 当前代码已移除条码扫描、商品查询接口和 `barcode/productImageUrl` 字段，账本只保留手动 + AI 多轮确认。 | 回归断言 UI 没有扫码入口，后端无 product lookup API；旧数据迁移清理字段。 |

### 11. 相册 Tab

| 优先级 | 功能 | 当前实现 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 相册上传 | 照护人可上传图片/视频到相册，生成 `albumItems`，仅查看不可上传。 | 上传图片，断言上传进度、相册 tile、后端 `albumItems`。 |
| P0 | 分类筛选 | 分类：全部、成长、喂养、睡眠、健康、提醒/疫苗；相册只展示媒体项。 | 切换分类，断言过滤结果。 |
| P1 | 自动准入 | 生活照片/视频可自动保存；截图/UI/网页/纯文字图片忽略；不确定素材显示确认卡。 | 聊天上传 App 截图断言不入相册；奶瓶照片断言出现“保存到相册/忽略”；宝宝里程碑照片自动保存。 |
| P1 | 后续保存指令 | “刚才的视频保存到相册”等不带附件的后续指令可匹配最近媒体并生成保存。 | 上传视频后再发保存指令，断言对应视频进入相册。 |
| P1 | 相册预览编辑删除 | 相册图片/视频可预览；照护人可编辑标题/分类/标签或删除。 | 点击 tile 打开预览，编辑标题后保存；删除后 tile 消失。 |
| P2 | 文件名生成 | 保存到相册时根据标题和 MIME 生成展示文件名，避免原始随机名。 | 断言 album item 的 attachment name 使用标题扩展名。 |

### 12. 提醒 Tab

| 优先级 | 功能 | 当前实现 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 提醒列表 | 分组：今天要做、未来安排、已逾期、已完成；未完成计数包含今天、未来和逾期。 | 构造今日、未来、过期、完成提醒，断言分组数量和文案。 |
| P0 | 手动新建/编辑 | 同一表单支持时间模式 `一次/循环`、提醒方式 `通知/闹铃`、分类、日期时间或循环间隔、提示音。 | 新建四种组合：一次通知、一次闹铃、循环通知、循环闹铃。 |
| P0 | 完成/删除二次确认 | 完成和删除都使用自定义风格确认弹层；删除取消原生通知。 | 点击完成/删除先出现确认；取消不变，确认后状态/列表变化。 |
| P0 | Agent 创建提醒 | “10:45提醒我喂奶”生成一次通知；“每10分钟提醒我喂奶”生成循环闹铃；其他循环默认通知，明确闹钟才响铃。 | 后端单测和 Web pending/auto flow，断言 scheduleMode/alertMode/repeatRule。 |
| P1 | 循环喂奶锚点 | 喂奶循环初始按最近 milk 事件 + 间隔，否则当前时间 + 间隔；新增/编辑 milk 后重排。 | 构造最近 15:00 喝奶，每 3 小时提醒，断言 dueAt 18:00；新增 16:00 后重排 19:00。 |
| P1 | 延后 | 点击延后先二次确认，并选择新的日期和时间；确认后重新安排通知/闹铃。 | 点击延后先出现日期时间确认；取消不变，确认后 dueAt 和 history 更新。 |
| P1 | 系统状态 | 展示 scheduled、scheduled_inexact、permission_denied、failed、in_app_only 等状态。 | Mock 通知权限拒绝，断言状态文案。 |
| P2 | 快捷创建 | 疫苗、体检、洗澡、喂奶闹钟、喂药、复诊、自定义会填充聊天输入。 | 点击快捷按钮，断言进入聊天并填充 prompt。 |

### 13. 原生通知与全屏闹铃

| 优先级 | 功能 | 当前实现 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | Android 原生闹铃 | `AlarmReminderPlugin` + `AlarmManager`；ringing 到点发全屏通知/Activity 并循环播放柔和音。 | Android 真机创建循环闹铃，到点进入全屏页；关闭本次后声音停、下次重排。 |
| P0 | Android 普通通知循环 | alertMode=notification 使用普通通知，到点后原生侧自动排下一次。 | Android 真机或 Robolectric 风格测试 receiver，断言 event queue 有 nextDueAt。 |
| P1 | iOS 本地通知 | iOS 插件用 `UNUserNotificationCenter` 调度一次/循环；ringing 使用自定义短音，点击进入前端全屏闹铃页。 | iOS 模拟器构建；真机通知权限验证。 |
| P1 | 前端全屏闹铃页 | 原生事件或前台触发后显示绘本风闹铃 overlay，循环播放 Web 音频，点击关闭本次。 | Web 模拟 `ringingReminder` 事件，断言 overlay、关闭和 nextDueAt 更新。 |
| P2 | 系统限制说明 | iOS 不承诺后台强制全屏；Android 厂商系统可能降级到高优先级通知。 | 文档和 UI 状态保持平台中性，不承诺无法保证的能力。 |

### 14. 我的 Tab 与资料管理

| 优先级 | 功能 | 当前实现 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 查看小宝资料 | 昵称、阶段、出生/预产期、地区、家庭、我的身份、过敏、家庭照护人、运行版本信息。 | 进入我的页，断言资料和成员身份展示。 |
| P0 | 编辑小宝资料 | 照护人可编辑昵称、阶段、出生/预产期、地区、喂养方式、过敏；照护人列表来自家庭成员，不可手填。 | 编辑喂养方式为混合喂养，保存后 Agent 混合喂养追问生效。 |
| P1 | 只读提示 | 仅查看成员显示“仅查看”，隐藏编辑入口。 | 只读账号进入我的页，断言无编辑按钮。 |
| P1 | 家庭照护人列表 | profile 读取时后端按家庭成员 `is_caregiver=true` 动态生成照护人角色列表。 | 同家庭爸爸/妈妈照护人登录后，列表显示两者。 |

### 15. OpenAI/DeepSeek/Doubao 模型与配置能力

| 优先级 | 功能 | 当前实现 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | DeepSeek 模型 | DeepSeek V4 Pro/Flash 走 `deepseek` 配置，不支持图像/视频/低延迟。 | 后端 resolveModel 单测或请求 mock。 |
| P0 | Doubao 模型 | Doubao Seed 2.0 Pro/Lite 走方舟 `/chat/completions`，支持图片/视频和 low latency service tier。 | 选择豆包发送视频附件，断言请求 content 使用 `video_url`。 |
| P1 | API Key | DeepSeek、Doubao、Doubao ASR 支持 inline 或 file 读取。 | 缺 key 启动/请求返回可读配置错误。 |
| P1 | 低延迟默认关闭 | 前端默认关闭；开启后仅传 `lowLatencyEnabled` 并由后端设置 service tier。 | 初始发送请求不含低延迟；点击后包含。 |

### 16. 部署、云端与移动更新

| 优先级 | 功能 | 当前实现 | 自动化验证建议 |
| --- | --- | --- | --- |
| P0 | 后端健康检查 | `/api/health` 返回服务可用状态。 | 部署后 curl 健康检查。 |
| P1 | 阿里云部署脚本 | `scripts/deploy-aliyun-ecs.sh` 更新云端 jar/资源，可保留数据。 | CI 或手动脚本 dry run；部署后健康 + API smoke。 |
| P1 | 移动 OTA 包 | `scripts/build-mobile-update.sh` 生成 bundle，后端 `/api/mobile-updates/check` 下发。 | 构建 bundle 后 mock 原生 updater 检查版本切换提示。 |
| P2 | 测试数据重置 | `scripts/reset-test-data.sh` 用于清空本地/云端测试数据。 | 在临时 DB 执行，断言 auth/session/业务表/附件清空。 |

## 自动化测试分层建议

### P0 Web/API 回归

适合每次提交或大改后运行。

- API：登录、新成员角色校验、只读 403、状态读写共享/私有边界、附件权限。
- Web：登录、首次设置、Tab 切换、聊天发送 mock、自动记录卡、记录页三视图、账本新增、相册上传 mock、提醒新增/完成/删除。
- 视口：至少覆盖 `375x667`、`390x844`、`430x932`，并检查横向溢出。

### P1 Agent 语义模拟

适合后端单测或专门的 Agent fixture 测试。

- 喂奶完整记录、开始吃奶追问、混合喂养追问。
- 睡眠完整记录、睡着了追问。
- 每 10 分钟喂奶循环闹铃、10:45 一次喂奶通知、每 2 小时喝水循环通知。
- 小宝支出记账待确认，不把商品参考价自动入账。
- 图片/视频描述、截图不入相册、宝宝素材保存到相册。
- 撤销/删除历史记录能力边界。

### P1 移动布局与交互

适合 Playwright + 本地浏览器。

- 视口矩阵全量跑登录、聊天、记录、账本、相册、提醒、我的。
- 输入框聚焦模拟键盘收缩；确认发送按钮、底栏、弹层主按钮可见。
- 媒体预览、提醒编辑弹层、账本编辑弹层、待确认编辑表单无横向溢出。

### P2 原生设备回归

适合 Android/iOS 真机或模拟器专项。

- Android：本地通知权限、全屏闹铃、关闭本次、循环重排、媒体选择、麦克风权限。
- iOS：本地通知权限、短音通知、点击通知进入前端闹铃页、PHPicker 图片/视频选择、麦克风权限。
- OTA：安装旧包后下发新 bundle，验证资源更新但原生壳不变。

## 测试数据建议

后续脚本应准备以下可重复 fixture：

- 邀请码 A：空家庭，新照护人首次登录。
- 邀请码 B：已有爸爸照护人和完整小宝资料，用于妈妈/只读成员加入。
- 账号 A：照护人，已有聊天、提醒、账本、相册。
- 账号 B：同家庭照护人，验证共享记录/相册/账本和私有聊天/提醒。
- 账号 C：同家庭仅查看，验证所有写入口隐藏或 403。
- 账号 D：不同家庭，验证附件和共享数据隔离。
- 小宝资料：混合喂养、上海、已出生、有过敏“暂未发现”。
- 照护日志：近 7 天包含奶量、睡眠、多段时间线。
- 账本：当月多分类支出、跨月支出、大额支出。
- 媒体：宝宝照片、宝宝视频、奶瓶照片、App 截图、纯文字图片。

## 后续脚本生成建议

- 使用 Playwright 建立 `loginAs(role)`、`seedState(fixture)`、`mockAgent(response)`、`expectNoOverflow(viewport)` 等 helper。
- API 层优先直接调后端创建家庭、邀请码、用户和初始状态，减少 UI 准备成本。
- Agent 语义测试优先走后端单测或 mock 模型响应 + EffectPolicy，避免真实模型不稳定影响回归。
- 原生提醒测试拆成两层：JS 层 mock `AlarmReminder` 插件验证调度参数；真机专项验证系统行为。
- 媒体上传测试拆成 local mock 小文件和 OSS presign mock，不把大视频放入常规 smoke。
- 断言用户可见文案不要出现内部字段名：`milkMl`、`feedingType`、`dueAt`、`intervalMinutes`。

## 主要代码索引

- 前端入口与页面：`frontend/src/App.tsx`
- 类型定义：`frontend/src/types.ts`
- 状态 API：`frontend/src/appStateApi.ts`
- 登录 API：`frontend/src/authApi.ts`
- Agent API：`frontend/src/agentApi.ts`
- ASR API：`frontend/src/asrApi.ts`
- 相册规则：`frontend/src/albumDomain.ts`
- 原生闹铃桥：`frontend/src/nativeAlarm.ts`
- OTA 运行时：`frontend/src/mobileUpdates.ts`
- 后端登录：`backend/src/main/java/com/xiaobao/babycompanion/auth/AuthService.java`
- 后端状态：`backend/src/main/java/com/xiaobao/babycompanion/service/AppStateService.java`
- 后端附件/OSS：`backend/src/main/java/com/xiaobao/babycompanion/service/AttachmentStorageService.java`
- Agent 主链路：`backend/src/main/java/com/xiaobao/babycompanion/agent/AgentRuntime.java`
- Agent planner：`backend/src/main/java/com/xiaobao/babycompanion/agent/AgentPlanner.java`
- 规则抽取：`backend/src/main/java/com/xiaobao/babycompanion/agent/RecordSignalExtractor.java`
- Effect 策略：`backend/src/main/java/com/xiaobao/babycompanion/agent/EffectPolicy.java`
- ASR WebSocket：`backend/src/main/java/com/xiaobao/babycompanion/asr/DoubaoAsrWebSocketHandler.java`
- 数据库迁移：`backend/src/main/java/com/xiaobao/babycompanion/persistence/DatabaseInitializer.java`
- Android 闹铃：`android/app/src/main/java/com/xiaobao/growthcompanion/AlarmReminderPlugin.java`
- Android 闹铃页：`android/app/src/main/java/com/xiaobao/growthcompanion/AlarmRingingActivity.java`
- iOS 闹铃：`ios/App/App/AlarmReminderPlugin.swift`
- iOS 媒体选择：`ios/App/App/NativeMediaPickerPlugin.swift`
