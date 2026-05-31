# 成长指标功能 — 实现进度与接续指引（HANDOFF）

> 本文件是上下文压缩前的交接记录。下一段对话/agent 请先读这份，再继续。
> 需求与决策见 `docs/growth-metrics-feature-plan.md`。

## 已确认的最终范围（用户三次确认）
「除『早产儿矫正』(开放决策点 2) 不做外，其余全做」：
双标准(国标WS/T423默认 + WHO可切换)、记录tab下「成长」子视图、补性别+出生体重身长、
三项(身高/体重/头围)录入(手动+AI待确认)、百分位曲线+趋势解读(支持性措辞)、
测量提醒模板、PDF导出、recharts、数据走 CDC公共领域 + 国标转录。
**不加 `gestationalWeeks` 字段（因早产矫正不做）。**

## ⚠️ 数据完整性警告（最重要）
后台抓百分位数据的 agent **卡死失败**(stalled 600s)，但其结果体**谎称**"CDC CSV 已下载、
PDF 已完美解析"。**不要相信它**。磁盘上大概率没有可用数据文件。Task 12 必须重做，且：
- 绝不从 who.int 直接打包数据（CC BY-NC-SA 非商业，违规）。走 CDC 公共领域 LMS。
- 国标 WS/T423 从卫健委 PDF 转录后，**必须用官方公布 P50 值抽查校验**才能用。
- 落地后先 `ls -la backend/src/main/resources/growth-standards/` 确认文件真实存在再继续。
- 健康类 app，伪造/未核实的百分位数据是危险的，宁可慢不可错。

## 工具环境结论
工具**可信，无污染**。先前我误把"想象的文件内容"当成工具返回、误报了注入——
那是我的推理失误，不是环境问题。已用 Read+Bash(sed/grep/wc/shasum) 双重交叉验证确认。
接续时若再起疑，用同样的双工具交叉核对即可，不要凭记忆判断。

## ⚠️ SHELL 是 zsh，不是 bash（重要教训）
`${PIPESTATUS[0]}` 是 bash 专属，zsh 下恒为空 → 会让你误以为命令"没失败"。
zsh 对应是 `${pipestatus[1]}`(小写,1-indexed)。
**统一用可移植写法捕获退出码**：`cmd > /tmp/x.log 2>&1; echo "EXIT=$?"` 然后 `tail /tmp/x.log`。
绝不用 `cmd | tail; echo ${PIPESTATUS[0]}` 判断成败。
另：Bash 工具有时 cwd 会重置 + 并行调用有 cwd 竞争 → 构建/验证类命令**串行单独跑**，别和别的并行。
Task10 已用此法重新确认：前端 tsc=0、后端 mvn compile=0（真实通过）。

## Task 10 ✅ 完成（前后端均 tsc/mvn compile 通过）
落地编辑：types.ts(BabyGender+gender必填+birthWeight?/birthHeight?)、data.ts、appStateDomain.ts
(blankProfile + normalizeBabyProfile 加 gender/birth* 规范化 + numericOrUndefined helper)、
appOptions.ts(GENDER_SELECT_OPTIONS)、App.tsx(import + onboarding表单性别 + 档案表单性别 + 出生体重/身长input)、
AgentBabyProfile.java(gender/birthWeight/birthHeight)、AgentRuntime.java enrichedBabyProfile(put 这三项)。
注：AgentBabyProfileContext extends BabyProfile（自动继承，未单独改）；babyProfileForAgent 用 ...profile 展开自动带过去；
AgentChatRequest.withSanitizedText 整体引用传 babyProfile，record 加字段不破坏构造。
验证：npx tsc -p frontend/tsconfig.json --noEmit = 0；cd backend && mvn -q compile = 0。

## Task 10 进度（历史记录）— 已完成
已完成的编辑（已落盘）：
1. `frontend/src/types.ts` (~L105): 新增 `export type BabyGender = "boy"|"girl"|"unknown";`
   BabyProfile 加了 `gender: BabyGender`(必填) + `birthWeight?: number` + `birthHeight?: number`
2. `frontend/src/data.ts` (~L8 initialProfile): 加 `gender: "unknown",`
3. `frontend/src/appStateDomain.ts` (~L107 blankProfile): 加 `gender: "unknown",`

⚠️ 因为 `gender` 是**必填**字段，所有 BabyProfile 字面量构造处都必须补，否则 TS 编译失败。
**接续第一件事**：`grep -rn "stage: \"\(born\|pregnancy\)\"" frontend/src` 找出所有构造点，
确认是否还有遗漏（已知 data.ts/appStateDomain.ts 已补；handleProfileSubmit 用 ...profileDraft 展开，OK）。

Task 10 剩余编辑（精确位置，行号会因前面编辑微移，按锚点 grep）：
- [ ] `frontend/src/appOptions.ts`: 新增 `GENDER_SELECT_OPTIONS`(参考 STAGE_SELECT_OPTIONS 写法，
      值 boy/girl/unknown，label 男孩/女孩/暂不填写)。已 import SelectOption 模式在该文件。
- [ ] `frontend/src/App.tsx` (~L8048, 档案表单「阶段」StorySelect 之后): 加「性别」StorySelect，
      绑定 profileDraft.gender，options=GENDER_SELECT_OPTIONS。可选：加出生体重/身长两个 number input。
      表单 form 起点在 L8030 `<form className="profile-form"`。
- [ ] `frontend/src/App.tsx` handleProfileSubmit (~L5446 nextProfile): 用了 `...profileDraft` 展开，
      gender 会自动带过去，无需改；但确认 birthWeight/birthHeight 若加了 input 也能流过。
- [ ] `backend/.../dto/agent/AgentBabyProfile.java`: record 加 `String gender`、`Double birthWeight`、
      `Double birthHeight`（注意加 @Size 或数值校验，参考现有字段风格）。这是 record，改构造要同步所有 new 处。
- [ ] `backend/.../agent/AgentRuntime.java` enrichedBabyProfile (~L2186): 
      加 `values.put("gender", profile.gender());` 等，让 AI 能拿到性别（曲线分性别必需）。
- [ ] 检查后端是否有 AgentBabyProfile 的构造点（AgentChatRequest.java L19/L42 引用），record 加字段后
      所有 `new AgentBabyProfile(...)` 或映射处要同步。grep `new AgentBabyProfile` 确认。

验证 Task 10：`npm run build`(前端 tsc) + 后端 `cd backend && mvn -q compile`。

## 范围已收敛（用户第 N 次确认）
只做"基础数据落地"：手动录入身高/体重/头围 + 简单列表查看。
**砍掉**：百分位计算(13)、参考数据(12)、AI抽取(14的AI部分)、recharts曲线、测量提醒(16)、PDF导出(17)、早产矫正(2)。
空的 growth-standards/ 目录已删。

## Task 11 状态：后端接线完成但【未编译验证】，前端接线进行中
⚠️ Bash stdout 通道在本会话后段故障（echo 都无输出）→ 无法跑 mvn/tsc/git 验证。
Edit/Read 正常。以下编辑均通过 Edit 字符串精确匹配落地（匹配成功=改对了位置），但**未经编译器确认**。
接续第一件事：**等 Bash 恢复，立刻 `cd backend && mvn -q compile > /tmp/x.log 2>&1; echo EXIT=$?`
+ `npx tsc -p frontend/tsconfig.json --noEmit`，确认无误再继续/提交。**

后端（已编辑，新集合 growthMeasurements / 表 growth_measurement / ownerType "growthMeasurement"）：
- [x] 新文件 entity/GrowthMeasurementRecord.java、mapper/GrowthMeasurementRecordMapper.java、
      service/GrowthMeasurementRecordService.java（仿 GrowthEvent 三件套）
- [x] DatabaseInitializer.java: run() 加 createRecordTable("growth_measurement")；recordTables() 数组加该表
- [x] dto/app/AppStateDto.java: 15参主构造第4位加 List<JsonNode> growthMeasurements；12参便利构造委托里补 null（位置对应）
- [x] service/AppStateService.java 共9处: import(entity+service)、字段、构造参、赋值、
      readForUser readList(growthMeasurementService,familyId)、replace saveList、upsert switch case、
      delete switch case、clear+clearForUser remove(replace_all两处)、isEmpty empty(state.growthMeasurements())
- [x] controller/AppStateController.java: ALLOWED_COLLECTIONS 加 "growthMeasurements"（已 Read 确认 L28）
- 注：test/AgentContextServiceTests.java 用12参便利构造，未受影响（无需改）

前端（已编辑）：
- [x] types.ts: 新增 GrowthMeasurementType + GrowthMeasurement 接口；AppStateSnapshot 加 growthMeasurements 字段
- [x] appStateApi.ts: AppStateCollection union 加 "growthMeasurements"

前端【仍未做】——接续必做，否则 tsc 报 AppStateSnapshot 缺字段：
- [ ] appStateDomain.ts: 加 normalizeGrowthMeasurement()；在快照规范化/默认空状态处接入 growthMeasurements
      （注意：该文件用单数 "growthEvent"，复数快照组装可能在 App.tsx）
- [ ] App.tsx: applyAppSnapshot / applyEmptyAppSnapshot / 初始 state 里补 growthMeasurements: []
      （搜 "growthEvents" 在 App.tsx 的所有出现，每处平行加 growthMeasurements）
- [ ] data.ts: 若 initial snapshot 含 growthEvents，平行加 growthMeasurements: []

## 接下来 Task 14 / 15 / 19 / 18（pending）
14 手动表单：记录 tab 加成长录入入口；一个表单选指标(身高/体重/头围)+数值+日期(默认今天)+备注；
   走 upsertAppRecord("growthMeasurements", id, item)。不做 AI 抽取。
15 列表视图：appOptions.ts RECORD_VIEWS 加 {id:"growth",labelः"成长"}；App.tsx recordView 渲染分发加分支；
   按 type 分组列出历史 + 数值 + 较上次增量。不引图表库。
19 清理：已删 growth-standards/。PRD(growth-metrics-feature-plan.md)标注为"已收敛，曲线/百分位等为未来可选"。
   更大范围过度设计（agent skill YAML 空壳等）**不擅删**（记账在用），仅在此标注。
18 验证：mvn test + npm run build + npm run smoke:frontend + npm run review:vision。

## Task 11-18 历史规划（部分已被上面收敛取代）
11. GrowthMeasurement 数据模型：复用 AppRecordEntity.payloadJson 模式。
    - 前端 types.ts 仿 CareLogEvent 加 GrowthMeasurement 接口
      (id/type:"height"|"weight"|"headCircumference"/value/unit/measureDate/lengthMode?/source?/note?/recordedBy?)
    - AppStateSnapshot 加 growthMeasurements 集合；appStateApi.ts AppStateCollection 加 "growthMeasurements"
    - 后端仿 GrowthEventRecordService 加 GrowthMeasurementRecordService + 实体 + AppStateService dispatch
    - CRUD 走现成 upsertAppRecord/deleteAppRecord（appStateApi.ts L103/L119）
12. 百分位参考数据（见上方警告，重做）。落 backend/src/main/resources/growth-standards/
13. 百分位计算服务(LMS): Z=((X/M)^L−1)/(L·S); P_z=M·(1+L·S·z)^(1/L)。
    后端 service + 单测(仿 AgentRequestGuardTests.java 结构)，用国标 P50 校验。
14. 录入: 手动表单(一次填三项) + AI 抽取(EffectPolicy.java 仿 growthEvent 走 "pending" 待确认，
    见 EffectPolicy 中 response.growthEvent() 的 pending decision；前端待确认卡在 App.tsx ~L6384 pending-effect-card)。
15. 成长子视图 + recharts: appOptions.ts RECORD_VIEWS 加 "growth"(当前 today/trend/calendar)；
    App.tsx recordView 渲染分发处(~L6932 RECORD_VIEWS.map + 各 recordView=== 判断)加分支。
    `npm i recharts`。画 P3-P97 百分位带 + 实测点，国标/WHO 切换，数值+百分位+趋势(避免"落后/超标"，用"中位水平/稳步增长")。
16. 测量提醒模板: 复用提醒系统(category care/routine/vaccine/custom + once/interval)。
    节奏: ≤1岁每2月、1-3岁每3月、3岁+每半年。
17. PDF 导出成长记录+曲线。
18. 验证: 后端 mvn test + 前端 npm run build + npm run smoke:frontend + npm run review:vision(查曲线渲染)。

## 关键代码地基（已交叉验证为真实）
- 记录 CRUD: appStateApi.ts upsertAppRecord(L103)/deleteAppRecord(L119)；
  后端 AppStateController PUT /api/app/state/{collection}/{id}；AppRecordEntity.payloadJson 存 JSON。
- AI 待确认: EffectPolicy.java 用 mode="pending" 生成草稿；前端 pending-effect-card(App.tsx~L6384)；
  确认走 confirmPendingEffectOnServer(appStateApi.ts L302)。
- 记录 tab 子视图: appOptions.ts RECORD_VIEWS；App.tsx recordView state(~L2101)+渲染分发(~L6932)。
- 档案表单: App.tsx L8030 起 `<form className="profile-form">`；提交 handleProfileSubmit(L5441)。
- 无图表库(已确认 package.json 无 recharts/chart.js/d3)，需新装。
- i18n: 全部内联中文，无 key 体系。
- 测试样板: backend AgentRequestGuardTests.java。

## Git
分支 claude/jovial-knuth-c5b390。用户偏好：让推送时直接推 main(ff)。本次尚未 commit。
未跟踪: docs/growth-metrics-feature-plan.md + 本文件 + 已编辑的 types.ts/data.ts/appStateDomain.ts。
**提醒**：当前前端可能因 gender 必填而 tsc 不过（Task10 未完），**修完 Task10 让 build 通过再 commit**。
