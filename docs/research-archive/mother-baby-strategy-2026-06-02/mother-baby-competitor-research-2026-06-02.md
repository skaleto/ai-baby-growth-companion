# 小宝记母婴记录与陪伴竞品深度调研

- 日期：2026-06-02
- 范围：国内外母婴类 App 的“记录与陪伴”能力，不把电商作为近期功能方向
- 输入材料：Claude 近期 deep research、4 条并行 subagent 调研、公开资料核验、本仓库产品/代码事实
- 输出目的：明确小宝记的差异点、优劣势、下一步优化方向，并为后续 slide deck 和产品计划提供依据

## 0. 一句话结论

小宝记不应该做“又一个母婴综合平台”，也不应该短期进入电商、开放社区或专家课赛道。更好的方向是：

> 做一个 AI-first 的私域家庭照护记录与陪伴系统：让家人用语音、文字、照片和小票低摩擦记录宝宝的一天，自动沉淀成可交接、可回忆、可带去儿保的可信资料，并用温和洞察减少遗漏，而不是制造焦虑。

这条路避开了亲宝宝、宝宝树、妈妈网这类大平台的内容/社区/商品优势，也避开了海外 Huckleberry/Glow 在单域睡眠预测上的强势，转而放大小宝记已有的独特资产：聊天式 Agent、家庭共享、相册、账本、提醒、成长测量、今日发现。

## 1. 研究方法与证据质量

本轮调研不是直接复述 Claude 的结论，而是做了二次 fan-out：

- 国内竞品线：亲宝宝、宝宝树孕育、育学园、妈妈网孕育、时光小屋、小豆苗。
- 海外竞品线：Baby Tracker by Nighp、Huckleberry、Glow Baby、The Wonder Weeks、FamilyAlbum/Mitene、What to Expect、BabyCenter。
- 产品策略线：用户分层、JTBD、AI 差异化、风险、路线图。
- 代码/产品现状线：读取 README、需求文档、Claude 竞品文档、AI hub plan、前后端关键文件。

证据分级：

- 强证据：官方 App Store、官网、帮助中心、隐私政策、代码路径、仓库文档。
- 中证据：媒体稿、行业报告、第三方 app 镜像页。
- 弱证据：没有真机实测的 UI 细节、算法真实效果、用户留存和付费意愿。

特别说明：Claude 原报告自己也标注了“中文竞品 UI 视觉细节和真实跨域数据流证据弱”。这个谨慎态度是对的。本报告保留其“AI 中枢”方向，但补充了它覆盖不足的家庭私密相册、儿保资料包、隐私信任、家庭角色协同和低摩擦记录。

## 2. 市场背景

### 2.1 增量变小，留存和信任变重要

国家统计局 2026-01-19 发布的 2025 年人口数据中，全年出生人口为 792 万。对母婴 App 来说，这意味着新增用户池不是高速扩张市场，产品不能只靠获客和大平台流量，需要靠高信任、长期留存、家庭多成员协同来提高 LTV。

来源：[国家统计局 2025 年人口数据](https://www.stats.gov.cn/sj/sjjd/202601/t20260119_1962338.html)

### 2.2 记录类产品的真正痛点不是“有没有表单”

CHI 2025 的 baby tracking 研究指出，婴儿照护记录有几个真实窗口：

- 即时窗口：刚喂完、刚换完、刚睡下，家长需要快速确认“刚刚做了什么”。
- 交接窗口：另一个照护人接手时，需要知道上一次吃奶、睡觉、尿布、用药是什么时候。
- 累计窗口：一天或一周内看是否吃够、睡够、是否有趋势变化。
- 长期窗口：看成长、发育、医生问诊和家庭回忆。

这和小宝记的方向高度吻合：记录不是表单堆砌，而是“减少记忆负担 + 支持家庭交接 + 形成长期资料”。

来源：[Understanding Temporality of Reflection in Baby Tracking, CHI 2025](https://cs.pomona.edu/~apapoutsaki/papers/chi2025understanding.pdf)

### 2.3 记录产品的第二个战场是隐私信任

儿童与家庭数据涉及照片、视频、健康、位置、行为、家庭成员。研究和 App Store 隐私标签都显示，儿童/家庭类 App 常常存在广告、第三方 tracker、用户内容和敏感信息处理问题。小宝记暂不做电商，反而可以把“少商业化打扰、可导出、可删除、可解释”变成差异化信任资产。

来源：[What privacy concerns do parents have about children's mobile apps](https://arxiv.org/abs/1809.10841)

## 3. 国内竞品观察

| 产品 | 定位 | 记录与陪伴能力 | AI/智能化 | 家庭/私域 | 商业化与风险 | 对小宝记的启示 |
|---|---|---|---|---|---|---|
| 亲宝宝 | 成长记录云空间 + 科学育儿 + 亲宝宝商城 | 照片/视频上传、成长记录、成长 MV、照片打印、孕育指导 | “智能育儿助手”偏阶段化指导，未看到明确生成式 AI 记录闭环证据 | 强：一人上传全家共享，安全私密 | 会员、商城、照片打印、发育测评，商业化很重 | 私密家庭相册和长期保存值得借鉴；电商化不是小宝记近期方向 |
| 宝宝树孕育 | 经期/备孕/怀孕/育儿全周期平台，0-6 岁 | 产检、疫苗、身高体重、成长曲线、相册、社区 | 米卡 AI：基于孕周/月龄/习惯做 1v1 建议，智能日程管家同步产检/疫苗/里程碑 | 有爸爸版，但家庭共同记录证据不如亲宝宝强 | VIP、周知订阅、专家、商品优惠；医疗免责声明明确 | AI 日程和阶段化提醒有价值，但要避免平台式内容/商品过载 |
| 妈妈网孕育 | 孕期/备孕助手 + 妈妈社区 | 孕期记录、育儿记录、相册时间轴、亲友记录、喂养记录 | AI 解读 B 超单、语音记录喂养等能力痕迹 | 中强：邀请亲友一起记录 | 社区和广告色彩明显；隐私标签含照片/音频/敏感信息等 | 语音喂养记录是小宝记可以强化的低摩擦入口 |
| 育学园 | 崔玉涛系科学孕育/儿童健康管理 | 生长曲线、成长测评、辅食、喂养记录等公开资料可见 | 当前生成式 AI 证据不足 | 家庭协同证据不足 | 偏课程/健康服务，资料证据不完整 | 专家背书和“科学边界”重要，但不应把小宝记做成医生替代品 |
| 时光小屋 | 私密家庭成长相册 | 时间轴、照片/视频、日记、宝宝年龄换算、实体书 | 未见 AI 主线 | 强：家人共享、私密回忆 | VIP 存储、实体书/打印 | 相册不是附属功能，而是长期情感留存锚点 |
| 小豆苗 | 疫苗接种 + 儿童健康管理 | 疫苗预约/通知、电子接种证、儿保、成长曲线、用药等 | 偏智能接种/健康管理，不是生成式 AI | 家庭共同记录证据不足 | 在线支付、课程、健康服务；强调认证和安全 | 儿保资料包、疫苗提醒、标准来源是可信工具层 |

国内竞品共同点：

- 大平台都在覆盖 0-6 岁甚至备孕到育儿全周期。
- 记录、成长曲线、疫苗、相册、内容、社区往往揉在一起。
- 商业化多靠会员、课程、专家、商品、打印/实体服务。
- 记录和私密家庭空间是长期高频入口，内容/电商是平台扩展。

国内竞品对小宝记最重要的启示：

- 不要和大平台拼“百科、社区、商城、专家课”。
- 要把“家庭私域记录”做得比它们更轻、更可信、更 AI-first。
- 儿保/疫苗/成长曲线可以做，但必须来源清楚、措辞温和、不替代医生。
- “不做电商”可以成为信任卖点，而不是商业短板。

关键来源：

- [亲宝宝 App Store](https://apps.apple.com/cn/app/id672984826)
- [宝宝树孕育 App Store](https://apps.apple.com/cn/app/id523063187)
- [妈妈网孕育 App Store](https://apps.apple.com/cn/app/id881419775)
- [育学园官网](https://drcuiyutao.com/app.html)
- [时光小屋 App Store](https://apps.apple.com/cn/app/id565951606)
- [小豆苗 App Store](https://apps.apple.com/cn/app/id919857495)

## 4. 海外竞品观察

| 产品 | 定位 | 记录与陪伴能力 | AI/算法 | 家庭/回忆 | 商业化 | 对小宝记的启示 |
|---|---|---|---|---|---|---|
| Baby Tracker by Nighp | 朴素全能新生儿日志 | 喂养、尿布、睡眠、成长、里程碑、健康、PDF 导出、iCloud/Dropbox | 无 AI；成长按 WHO，支持早产 adjusted age | 多设备同步、照片里程碑 | 免费 + IAP/Pro | “医生可读导出”和夜间一键记录是硬刚需 |
| Huckleberry | 数据驱动睡眠/育儿伙伴 | 睡眠、喂养、尿布、吸奶、成长、药物、提醒、报告 | SweetSpot 预测睡眠；Berry 支持专家审定 AI、语音/文本/图片/批量记录 | 多设备同步，照片不是主轴 | Free/Plus/Premium | “命名 AI 资产 + 记得越多越准 + 多触点显化”值得直接借鉴 |
| Glow Baby | 全能 baby tracker + 图表 + 家庭计划 | 喂养、尿布、睡眠、吸奶、成长、里程碑、健康、PDF/CSV | Premium 预测下一次喂养/小睡，有比较洞察 | Family Plan 可加 caregiver | Premium / Family / lifetime | 色彩编码、周报、导出可借鉴；同伴比较要慎用 |
| The Wonder Weeks | 发展飞跃解释型陪伴 | 10 个 mental leaps、通知、游戏、日记、论坛 | 非 AI，按年龄/预产期预测 leap | 可链接伴侣 app | 订阅/IAP | 给家长“解释感”很强，但科学争议和焦虑风险也强 |
| FamilyAlbum/Mitene | 私密家庭相册 | 无限照片/视频、按月份和年龄整理、评论、1s Movies | 隐私政策提到 AI 上传建议/自然语言媒体搜索 | 核心是家庭共享，祖辈友好 | Premium + 照片书/DVD | 小宝记相册应和记录互相点亮，而不是孤立素材库 |
| What to Expect | 怀孕到宝宝的内容/社区/轻记录 | 孕期、症状、kick、出生后喂养/尿布/睡眠/里程碑 | 未确认 AI 主线 | 社区强 | 品牌推荐/广告/registry | 开放社区不适合小宝记早期 |
| BabyCenter | 大型孕育内容社区 | 孕期日历、成长 tracker、睡眠/喂养指南、社区 | 未确认 AI 主线 | Birth Club/社区强 | 免费 + 品牌折扣/registry | 内容权威和社区陪伴有价值，但会拉高运营和合规成本 |

海外竞品共同点：

- 基础 tracking 免费或低价，AI/预测/报告/高级协同进订阅。
- 低摩擦记录是成熟能力：Apple Watch、Siri、Live Activities、语音/文本/图片批量记录。
- 家庭共享通常停留在同账号或 sync group，中国家庭更需要角色权限。
- 隐私披露普遍复杂，照片、健康、标识符和第三方分析是信任风险。

关键来源：

- [Baby Tracker App Store](https://apps.apple.com/us/app/baby-tracker-newborn-log/id779656557)
- [Nighp Baby Tracker FAQ](https://nighp.com/babytracker/babytracker_faq.html)
- [Nighp Privacy](https://nighp.com/babytracker/babytracker_pp.html)
- [Huckleberry SweetSpot](https://huckleberrycare.com/blog/sweetspot-your-smart-sleep-timing-companion)
- [Huckleberry Berry FAQ](https://huckleberry.zendesk.com/hc/en-us/articles/44561361627667-What-is-Berry)
- [Huckleberry Pricing](https://huckleberrycare.com/pricing)
- [Glow Baby](https://glowing.com/glow-baby-app)
- [FamilyAlbum Help](https://help.family-album.com/hc/en-us/articles/360038267214-What-is-FamilyAlbum)
- [What to Expect App Store](https://apps.apple.com/us/app/pregnancy-baby-tracker-wte/id289560144)
- [BabyCenter App Store](https://apps.apple.com/us/app/pregnancy-tracker-babycenter/id386022579)

## 5. Claude 调研的精华与需要修正处

### 5.1 值得保留的精华

Claude 文档的核心贡献是把竞品对比从“功能清单”推进到“AI 价值显化”：

- Huckleberry SweetSpot/Berry 的启示：AI 不能匿名藏在某个模块里，要命名、可触达、可被用户记住。
- Glow 的启示：跨域记录需要色彩编码和一眼可扫的 stat card，而不是纯文字摘要。
- 小宝记已有聊天、careLog、账本、相册、提醒、Daily Summary 这些跨域数据，确实具备做“AI 中枢”的技术基础。
- 短期先动三件事是合理的：今日发现品牌化、宝宝今天 stat cards、成长最新值接入 Daily Summary。

对应仓库文档：

- `docs/superpowers/specs/2026-06-01-cross-app-design-review.md`
- `docs/superpowers/plans/2026-06-01-daily-summary-ai-hub.md`

### 5.2 需要修正或补充的地方

Claude 文档过于聚焦“视觉与 AI 中枢”，对以下方向覆盖不够：

- 家庭私域记录：亲宝宝、时光小屋、FamilyAlbum 都说明私密家庭共享是长期留存锚点。
- 医生/儿保资料包：Baby Tracker 的 PDF 导出、小豆苗的接种/儿保能力说明“可带去医生”的资料价值很强。
- 隐私信任：不做电商、不做开放社区、不卖数据，应该被包装成小宝记的品牌优势。
- 家庭角色权限：中国家庭不是“伴侣共享账号”那么简单，需要妈妈/爸爸/祖辈/育儿嫂/临时医生查看等差异权限。
- 焦虑控制：SweetSpot、Wonder Weeks、成长百分位都有焦虑风险；小宝记应坚持“观察到事实”而非“判断正常/异常”。

### 5.3 不能把方案当现状

代码 explorer 和主线程核对后确认：

- `DailySummaryView` 当前仍是 hero + facts 文本 + finding 列表，不是 stat card。
- `docs/superpowers/plans/2026-06-01-daily-summary-ai-hub.md` 是 implementation plan，尚未实现。
- 成长指标当前是 MVP：身高/体重/头围表单、历史、最新值、增量，没有曲线和百分位。
- 家庭共享存在，但消息、提醒、记忆、pendingEffects、会话摘要是 user 私有；家庭权限体系还不完整。
- Daily Summary 中某些 knownIds/data source 仍为空集合，会影响部分 finding 真正落地。

代码依据：

- `frontend/src/views/DailySummaryView.tsx`
- `frontend/src/views/GrowthEntryView.tsx`
- `frontend/src/App.tsx`
- `backend/src/main/java/com/xiaobao/babycompanion/service/AppStateService.java`
- `backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryService.java`

## 6. 小宝记当前能力与资产

### 6.1 已经具备的能力

小宝记不是从零开始的概念产品。当前已具备：

- 移动优先 React + Capacitor，已有 iOS/Android 工程。
- 聊天式记录入口，支持文本、语音、图片/视频附件。
- 后端 Agent SSE 流式接口，支持工具活动和状态反馈。
- Doubao ASR WebSocket 语音输入。
- 照护日志：奶量、喝奶次数、睡眠、夜醒、辅食、便便、体温、护理备注。
- 成长事件与里程碑。
- 成长测量：身高、体重、头围 MVP。
- 提醒：一次/循环、通知/响铃、疫苗/日常/照护/自定义、完成/延后。
- 相册：图片/视频、自动分类、候选入库、月度网格。
- 账本：月/年/明细、分类、附件、小票/图片支出识别。
- 家庭共享：family_id 数据层、成员角色、记录者标签。
- Daily Summary / 今日发现：facts、observations、missingItems、AI findings 雏形。
- OTA 和阿里云部署体系。

### 6.2 现在的短板

| 短板 | 现状 | 风险 |
|---|---|---|
| AI 价值显化弱 | 今日发现需要手动生成，且主要是文字 | 用户感受不到“AI 陪伴”的日常价值 |
| 成长指标粗糙 | 有记录，没有曲线/参考/儿保资料包 | table stakes 不够完整 |
| 家庭协同不完整 | family 共享和 user 私有混合，权限细节有限 | 祖辈/保姆/临时医生场景难承接 |
| 记录闭环不够强 | 聊天记录成功后，和趋势/提醒/相册的关联还不显性 | “即聊即录即洞察”没有形成飞轮 |
| 导出能力不足 | 目前不是儿保资料包产品 | 和 Baby Tracker、小豆苗相比工具信任弱 |
| 内容/医疗边界需要持续强化 | 已有安全边界，但未来 AI 洞察更复杂 | 模型幻觉和医疗越界风险 |

### 6.3 核心优势

- AI-first：已有聊天、流式 Agent、多模态、ASR、Daily Summary，比传统母婴记录 App 更适合“低摩擦整理”。
- 跨域数据：照护、成长、相册、账本、提醒都在一个应用里，具备做跨域洞察的基础。
- 私域家庭：不是开放社区，不必承担早期社区运营/审核成本。
- 账本差异化：母婴大平台多不把账本作为核心，小宝记已具备育儿消费记录与票据识别。
- 本地工程成熟：harness、frontend verification、mobile sync、OTA、Aliyun 都已经跑通。

## 7. 用户分层与核心场景

### 7.1 用户分层

| 用户 | 核心需求 | 产品策略 |
|---|---|---|
| 0-1 岁新手妈妈 | 喂养、睡眠、尿布、体温、疫苗、成长；最怕漏记和被指责 | 减少手填，文案温和，支持夜间快速记录 |
| 爸爸 | 下班后快速知道今天发生什么，接手提醒 | 今日交接摘要、待办、记录者署名 |
| 祖辈 | 看照片、看提醒、偶尔记录，不想复杂操作 | 大按钮、少术语、只读/可记录边界 |
| 育儿嫂/月嫂 | 班次交接、证明做过什么 | 语音交接单、记录者标签、雇主可回看 |
| 高焦虑用户 | 想知道是否正常、是否漏 | 事实趋势 + 儿保资料包，不做诊断 |
| 轻记录用户 | 不想填表，只想拍照或说一句 | AI 多项抽取，默认少字段 |
| 二胎/多照护人家庭 | 家庭成员多，信息容易不一致 | 角色权限、交接摘要、责任人提醒 |

### 7.2 高频 JTBD

核心 job-to-be-done 不是“记录宝宝”，而是：

- 当我手忙脚乱时，用最少动作留下可信记录。
- 当家人接手时，快速知道宝宝今天吃了、睡了、拉了、哭了、谁处理过。
- 当医生/儿保问起时，能拿出连续、清楚、不过度加工的资料。
- 当我焦虑时，看到事实趋势，而不是被 App 制造更多担心。
- 当宝宝成长时，把照片、里程碑和日常照护自然连起来。

## 8. 差异化定位

### 8.1 不做什么

近期明确不做：

- 电商首页、商品推荐、品牌团购。
- 开放母婴社区、问答广场、同龄攀比榜。
- 医疗诊断、用药判断、疾病图片识别。
- 大而全孕育百科平台。
- 过度游戏化打卡、积分排名、焦虑型异常提示。

### 8.2 做什么

小宝记应聚焦 5 个差异化资产：

1. **低摩擦记录**  
   语音/文字/图片一次记录多项，让“3 点喝奶 120ml，换了尿布，睡到 5 点”直接形成可确认记录。

2. **家庭交接中枢**  
   晚间或接手时自动回答：今天谁记了什么、哪些提醒完成了、下一件要做什么、哪里需要补一下。

3. **可信资料包**  
   一键生成近 7/30 天喂养、睡眠、体温、用药、成长、疫苗、异常备注，给儿保/医生看。

4. **私密回忆与里程碑**  
   相册不是图库，而是和照护记录互相点亮：照片触发里程碑候选，日常记录沉淀成月报/成长故事。

5. **温和 AI 洞察**  
   命名化的“今日发现”只做事实关联、轻提醒、下一步建议，不做吓人判断。

### 8.3 品牌定位建议

可用定位：

> 小宝记：少填一点，家人同步一点，宝宝的一天就被温柔整理好。

避免定位：

- “AI 医生”
- “宝宝发育评判器”
- “母婴全能平台”
- “母婴购物助手”

## 9. SWOT

| 维度 | 内容 |
|---|---|
| Strengths 优势 | AI-first 记录入口；多域数据已在同一 App；账本/相册/提醒/成长/家庭共享地基存在；不做电商可建立信任；移动端和部署体系成熟 |
| Weaknesses 劣势 | UI 价值显化不足；成长曲线/导出/角色权限未完善；真实用户验证不足；模型质量和隐私策略还需产品化 |
| Opportunities 机会 | 大平台商业化重、隐私复杂；海外 AI logging 和医生可读导出证明方向可行；中国家庭多照护人场景强；儿保资料包和家庭交接仍有空位 |
| Threats 威胁 | 亲宝宝/宝宝树流量和内容强；Huckleberry/Glow AI 预测成熟；医疗和儿童隐私合规风险高；记录 App 容易因焦虑或负担被弃用 |

## 10. 路线图建议

### 0-4 周：把 AI 中枢做成用户能看见的价值

目标：让用户第一次打开记录页就能理解“AI 在帮我整理宝宝的一天”。

优先事项：

1. 今日发现品牌化  
   把匿名 DailySummaryView 改成固定资产，例如“小宝今日观察”或“小宝陪记”。加固定图标、品牌头、基于 N 条记录生成的反馈。

2. 宝宝今天 stat cards  
   把 facts 文字升级为奶量、睡眠、喂养/护理次数的色彩编码卡片。借鉴 Glow，但避免炫技。

3. 成长最新值接入今日发现  
   先不做复杂曲线，把身高/体重/头围最新值和最近变化放进今日发现，消除成长页孤岛。

4. 聊天记录成功反馈  
   记录成功后显示“刚刚记录了什么”，并在可能时给出一条关联发现，例如“今天奶量已接近最近 3 天均值”。

5. 温和提醒文案  
   将“漏项”改成低压力文案：“今天还没看到便便记录，要补一下吗？”而不是“缺失/异常”。

验证：

- 5-10 个目标家庭访谈：是否愿意每天看；是否减少家庭交接成本；有没有焦虑感。
- 跟踪记录成功率、用户修改字段率、今日发现查看率、生成后行动点击率。

### 1-2 个月：从记录工具升级为家庭交接和儿保资料工具

目标：让小宝记在“多人照护”和“医生问诊”时不可替代。

优先事项：

1. 儿保资料包 MVP  
   支持导出近 7/30 天喂养、睡眠、便便、体温、用药、成长、疫苗、异常备注。先做 PDF/图片或可复制摘要。

2. 家庭角色权限  
   区分妈妈/爸爸/祖辈/育儿嫂/只读成员；支持记录者署名、家庭交接摘要。

3. 提醒模板标准化  
   疫苗、喂药、奶间隔、儿保、体温观察等模板，明确“按本地社区医院/医生为准”。

4. 相册里程碑候选  
   对用户上传的照片/视频做候选，不自动入库，允许用户确认“第一次翻身/坐/站”等。

5. Daily Summary 数据源补齐  
   补全 reminder/member/memory knownIds 和跨域数据，让已设计的 findings 真正可用。

验证：

- 找 3-5 个儿保/医生问诊场景回放，测试资料包是否能回答医生常问问题。
- 家庭成员角色测试：祖辈是否能看懂，育儿嫂是否愿意用语音交接。

### 3-6 个月：扩展生命周期和可信商业化

目标：避免 1 岁后流失，探索不伤信任的付费能力。

优先事项：

1. 1-3 岁扩展  
   辅食/过敏、语言动作里程碑、托育交接、习惯养成、用药/发热记录。

2. 周报/月报  
   不是“打卡成绩”，而是家庭回顾：本周作息、成长、照片、提醒完成、儿保资料。

3. 成长曲线决策  
   若解禁，优先中国儿保语境和标准来源，明确曲线只作参考；避免同龄排名焦虑。

4. 隐私增强版策略  
   明确宝宝数据不卖、不用于广告；支持导出、删除、成员权限、模型输入说明。

5. 商业化候选  
   高级 AI 周/月报、长周期回忆册、高清/大容量备份、儿保资料包高级模板、多家庭/多宝宝、隐私增强。基础记录和家庭共享应保持免费。

## 11. 近期功能优先级

| 优先级 | 功能 | 为什么 | 复杂度 | 依赖 |
|---|---|---|---|---|
| P0 | 今日发现品牌化 + 反馈闭环 | 最快显化 AI 价值 | S | 已有 DailySummaryView |
| P0 | 宝宝今天 stat cards | 解决“全是文字”的粗糙感 | M | careLog 数据 |
| P0 | 成长最新值接入今日发现 | 消除成长孤岛，不必先上曲线 | M | growthMeasurements |
| P1 | 聊天记录成功摘要 | 放大即聊即录 | M | Agent effect decision 展示 |
| P1 | 儿保资料包 MVP | 和竞品形成工具信任差异 | M-L | 记录数据聚合/导出 |
| P1 | 家庭交接摘要 | 契合中国多照护人场景 | M | recordedBy/权限 |
| P1 | 相册里程碑候选 | 把回忆和记录互相点亮 | M | 现有 album prompt |
| P2 | 成长曲线/参考 | table stakes，但需标准和授权决策 | L | 标准数据、文案边界 |
| P2 | 1-3 岁扩展 | 提高生命周期 | L | 目标用户验证 |
| P3 | 开放社区/内容平台 | 暂不建议 | L/风险高 | 运营与合规 |
| P3 | 电商 | 用户已明确暂不做 | L/偏离定位 | 商业决策 |

## 12. 关键产品原则

1. **先记录，再解释；先事实，再建议。**  
   AI 洞察必须能回链到原始记录。

2. **少问、少填、少吓人。**  
   追问只在保存必要字段缺失时出现；趋势文案用“观察到”，不用“异常/风险”。

3. **家庭内共享优先于公开社区。**  
   对小宝记来说，家庭协同比宝妈广场更重要。

4. **儿保资料包优先于复杂医学解读。**  
   给医生看，比替医生判断更安全、更有价值。

5. **隐私是产品功能，不是法律附录。**  
   导出、删除、权限、模型输入说明都应在用户界面可见。

6. **基础记录永久免费。**  
   如果未来商业化，应围绕高级 AI、长期回忆、容量、资料包、家庭协同增强，而不是锁核心记录。

## 13. 待决策问题

1. 成长曲线是否解禁？  
   如果解禁，标准来源用什么：WHO、WS/T 423、中国儿保参考，还是多标准可选？

2. 今日发现未来免费还是 Pro？  
   建议短期免费验证价值；高级周报/月报、长周期洞察再考虑付费。

3. 家庭权限边界怎么定？  
   哪些数据 family 共享，哪些 user 私有，育儿嫂和临时医生如何授权？

4. 儿保资料包先做 PDF、图片、还是可复制文本？  
   MVP 可以先做可复制摘要和图片导出，减少实现成本。

5. 1 岁后是否扩到 1-3 岁？  
   如果产品只覆盖孕期到 1 岁，LTV 会短；建议 3-6 个月内验证 1-3 岁延展。

## 14. 建议马上启动的第一轮

第一轮不要做大而全，建议只启动一个产品主题：

> 小宝今日观察：AI 中枢 + 家庭交接 + 成长最新值。

范围：

- DailySummaryView 品牌化。
- stat cards。
- 成长最新值接入。
- 记录成功反馈。
- 温和提醒文案。
- 1 个可复制的“今日交接摘要”入口。

成功标准：

- 用户看得懂“这是 AI 帮我整理的一天”，而不是普通列表。
- 家庭成员能通过一个摘要接手照护。
- 所有 AI 洞察都能追溯到原记录。
- 不引入医疗判断。
- 不引入电商或开放社区。

## 15. 附录：本仓库现状证据

- 产品定位与 MVP：`README.md`、`docs/product-requirements.md`
- Claude 竞品评审：`docs/superpowers/specs/2026-06-01-cross-app-design-review.md`
- AI hub 计划：`docs/superpowers/plans/2026-06-01-daily-summary-ai-hub.md`
- 今日发现当前 UI：`frontend/src/views/DailySummaryView.tsx`
- 成长测量当前 UI：`frontend/src/views/GrowthEntryView.tsx`
- 主导航与记录结构：`frontend/src/appOptions.ts`、`frontend/src/App.tsx`
- 家庭共享和集合读写：`backend/src/main/java/com/xiaobao/babycompanion/service/AppStateService.java`
- Daily Summary 后端：`backend/src/main/java/com/xiaobao/babycompanion/service/DailySummaryService.java`
- Agent 接口与流式：`backend/src/main/java/com/xiaobao/babycompanion/controller/AgentController.java`、`frontend/src/agentApi.ts`
- 医疗安全边界：`backend/src/main/java/com/xiaobao/babycompanion/agent/AgentPrompts.java`

## 16. 附录：公开来源清单

- [国家统计局 2025 年人口数据](https://www.stats.gov.cn/sj/sjjd/202601/t20260119_1962338.html)
- [CHI 2025 baby tracking research](https://cs.pomona.edu/~apapoutsaki/papers/chi2025understanding.pdf)
- [儿童 App 隐私风险研究](https://arxiv.org/abs/1809.10841)
- [亲宝宝 App Store](https://apps.apple.com/cn/app/id672984826)
- [宝宝树孕育 App Store](https://apps.apple.com/cn/app/id523063187)
- [妈妈网孕育 App Store](https://apps.apple.com/cn/app/id881419775)
- [育学园官网](https://drcuiyutao.com/app.html)
- [时光小屋 App Store](https://apps.apple.com/cn/app/id565951606)
- [小豆苗 App Store](https://apps.apple.com/cn/app/id919857495)
- [Baby Tracker App Store](https://apps.apple.com/us/app/baby-tracker-newborn-log/id779656557)
- [Nighp Baby Tracker FAQ](https://nighp.com/babytracker/babytracker_faq.html)
- [Nighp Privacy](https://nighp.com/babytracker/babytracker_pp.html)
- [Huckleberry App](https://explore.huckleberrycare.com/app/)
- [Huckleberry SweetSpot](https://huckleberrycare.com/blog/sweetspot-your-smart-sleep-timing-companion)
- [Huckleberry Berry FAQ](https://huckleberry.zendesk.com/hc/en-us/articles/44561361627667-What-is-Berry)
- [Huckleberry Pricing](https://huckleberrycare.com/pricing)
- [Glow Baby](https://glowing.com/glow-baby-app)
- [Glow Safety](https://glowing.com/apps/privacy-security-faqs)
- [FamilyAlbum / Mitene](https://mitene.us/)
- [FamilyAlbum Help](https://help.family-album.com/hc/en-us/articles/360038267214-What-is-FamilyAlbum)
- [The Wonder Weeks App Store](https://apps.apple.com/us/app/the-wonder-weeks-baby-leaps/id529815782)
- [What to Expect App Store](https://apps.apple.com/us/app/pregnancy-baby-tracker-wte/id289560144)
- [BabyCenter App Store](https://apps.apple.com/us/app/pregnancy-tracker-babycenter/id386022579)
