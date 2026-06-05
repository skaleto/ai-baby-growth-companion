# Progress Log

## Current Verified State

- Repository root: `/Users/bytedance/Documents/ai-baby-growth-companion`
- Branch: `main`
- Standard start path: `bash harness/init.sh`
- Standard smoke gate: `git diff --check`, `npm run build`, `npm run test:agent-benchmark`
- Full gate: `bash harness/init.sh --full`
- Cloud target: `120.55.188.242:8300`
- Current app development roadmap: `harness/app-development-roadmap.md`
- Current highest-priority active feature: none
- Current blocker: none recorded for harness creation

## Session Log

### Session 2026-06-05 Real User UX Fix ECS + OTA Release

- Goal: 发布真实用户路径修复到 ECS，并下发 OTA 包；保持 `SYNC_DATA=0`，不覆盖生产 SQLite 或 auth secret。
- Completed:
  - ECS: `SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 npm run deploy:aliyun` 完成 JAR 构建、上传、systemd restart 和健康检查。
  - OTA: `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 MOBILE_UPDATE_MESSAGE='记录体验优化：自动写入更准确，语音输入可上滑取消，页面提示更清爽' npm run build:mobile:update` 生成 `0.1.0-20260605223856`。
  - OTA 防事故验证: 本地拆包与生产下载包均确认 `120.55.188.242:8300` 存在、`localhost:8080` 为 0；manifest checksum 与生产下载 checksum 均为 `4b00053a4cf3484a5328117d6d6557da1397835e27bd7d3fcb252d86831eec88`。
- Verification run:
  - `bash harness/init.sh` 通过：`git diff --check`、`npm run build`、`npm run test:agent-benchmark`。
  - `GET http://120.55.188.242:8300/api/health` 返回 `ok`。
  - `POST /api/mobile-updates/check` 使用旧 `currentBundleVersion` 返回 `updateAvailable=true`；使用当前 `0.1.0-20260605223856` 返回 `updateAvailable=false`。
- Known risks:
  - 未做真机安装后的 Capgo apply 行为验证；当前证据覆盖服务健康、OTA check、bundle download checksum 和 bundle base URL。

### Session 2026-06-05 R1 第一波: error boundary + Pro entitlement + 邀请管理 + 监控

- Goal: 用户从 R1 待办选 4 项(Pro 真实权益、邀请泄漏踢人/撤权/清 token、最小监控告警、前端崩溃 error boundary)，按风险两波推进；本会话完成第一波并发布。
- Completed + 已上生产:
  - 前端崩溃 error boundary (REQ-OBS-001, `8476b54`): `AppErrorBoundary` 包裹 App/OfficialSite + sage 降级页 + `errorReporting.ts` 上报 `/api/client-errors`(限流+keepalive) + 全局 onerror/unhandledrejection。
  - Pro 真实 entitlement (REQ-PRO-001, `ac77176`): `isProEnabled`/`requireProCaregiver` 切到家庭 entitlement；启用此前 @Disabled 的 gating 测试；前端恢复申请入口；`seed-internal-pro-entitlements.sh`。**dry-run 确认唯一真实家庭 `eb3f4751` 已有有效 entitlement(到 2026-06-15)**，其余 6 个空壳/测试家庭无需种，迁移跳过(省一次生产写)。
  - 家庭成员管理 (REQ-AUTH, `8da6014`): 后端成员列表/踢人(撤全部 session+删成员)/撤权(改 caregiver+撤 session)/重置邀请码(作废旧码+发新码)，限 caregiver、不自伤、复用 session 制清 token、不动 JWT 结构；前端设置页家庭成员卡片。`FamilyMemberManagementTests` 覆盖列举/踢人清 token/撤权/重置码。
  - 监控告警+备份 cron (REQ-OPS-004/002, `0c14d79`+`fc4dbb3`): host 侧 `monitor.sh`(5xx 比例/磁盘/备份新鲜度→钉钉飞书 webhook) + `install-monitoring.sh`(配 cron: 监控每15分钟/备份每日03:30)。已部署: smoke `OK (5xx 0/6=0%, disk 18%, backup 0h)`，首个备份已种。
- 发布证据:
  - 后端 deploy 两轮(Pro jar 15:09 → 邀请 jar 17:19)，拆 jar 确认 R0.5 类 + `family/members`/`invite-code/reset` 路由进包，启动 0 error。
  - OTA `0.1.0-20260605164158`(error boundary+Pro UI) → `0.1.0-20260605171919`(邀请 UI)，均 base URL 零 localhost、check+checksum 逐字节匹配。
  - 全量后端测试 261+ 全过(每次后端改动后跑)。
- 待办 / 风险:
  - 监控 webhook 待用户提供钉钉/飞书 URL(现空 URL 只写 `/var/log/baby-monitor.log`)，拿到后重跑 `install-monitoring.sh` 即接上。
  - ⚠️ 真实家庭 `eb3f4751` Pro entitlement **2026-06-15 到期**，需续期(`pro_trial_entitlement.expires_at`)。
  - 第二波: Pro 图片/视频额度 gate(task #9, 动 `AgentRuntime` 视觉链路 `analyzeVisualInputsInBatches`/visualInputs，必须单独跑 `npm run test:agent-benchmark` + 超限优雅降级、不中断流)。
  - 真机验证: error boundary 降级页 / Pro 申请入口 / 家庭成员管理 UI 待真机 OTA 后确认。

### Session 2026-06-05 项目文件盘点、归档与低风险清理

- Goal: 梳理项目下大量文件，分清核心入口、历史归档、生成物和本地杂物；更新明显过时的入口文档，删除低风险冗余文件，保护当前未提交 R0.5 改动和本地/生产数据。
- Completed:
  - 新增 `docs/project-file-inventory-2026-06-05.md`，记录当前文件分类、应优先读取的入口、可再生成目录、不可随手删除的数据目录、已清理项和后续候选清理项。
  - 新增 `docs/archive/README.md` 与 `docs/archive/completed-2026-06-05/README.md`，将完成态历史材料从 `docs/` 根目录移入 `docs/archive/completed-2026-06-05/`。
  - 归档完成态 OpenSpec changes 到 `openspec/changes/archive/2026-06-05/`，当前 `openspec/changes/` 下不再暴露已完成变更作为 active work。
  - 更新 `README.md`、`docs/aliyun-ecs-deploy.md`、`harness/quality-document.md`，把当前入口切到 roadmap / release-hardening spec / feature inventory，并补上 OTA base URL 事故、`SYNC_DATA=0` 部署准则和当前安全风险摘要。
  - 新增 `harness/project-index.md` 作为项目总索引，并更新 `AGENTS.md`、`README.md`、`harness/README.md` 指向该入口，避免后续 agent 通过扫全目录决定上下文。
  - 按用户确认继续归档非红框候选项：`docs/superpowers/plans/2026-05-26-cross-domain-daily-summary.md`、`docs/superpowers/plans/2026-06-01-daily-summary-ai-hub.md`、`docs/product-requirements.md`、`docs/security-risks.md` 已移入 `docs/archive/completed-2026-06-05/`。
  - `.gitignore` 增加 `.claude/`；删除 `.claude/launch.json`、所有 `.DS_Store`、`frontend.log`、`backend/backend.log`、`backend/backend.pid`、`.verification/`。
- Known risks:
  - 本轮不删除 `backend/data/`、`backend/backend/data/`、`backups/` 或任何生产/本地数据；按用户截图要求，`backend/backend/data/` 明确保持原样。
  - 当前工作区已有 R0.5 代码改动，本轮只保护和记录，不回滚也不重写。

### Session 2026-06-05 R0.5 后端 + 首登页配色 OTA 生产发布

- Goal: 把本会话累积的 R0.5 后端改动 + 首登知情同意页配色 sage 化，发布到生产 (120.55.188.242:8300)，使生产前后端一致。
- 关键避坑 (记入经验):
  - 生产后端 R0.5 接口返回 401 一度被误判为“已部署”；实际 401 是 Spring Security 对所有未鉴权请求的通杀 (连不存在路径也 401)。拆生产 jar (`python3 zipfile`) 确认 DataRights/ClientError/CapabilityManifest 类全缺，才定位到后端 00:00 版本根本不含 R0.5。教训: 401≠404≠存在，结构性证据靠拆 jar，不靠 HTTP code。
  - 发布前真实状态: 前端 OTA 122812 含全部 R0.5 前端、后端不含 → 数据权利 404、手机号不脱敏、agent 用旧能力 prompt 的不一致态。
- Completed:
  - 后端: `SSH_KEY=~/.ssh/ai_baby_aliyun SYNC_DATA=0 SYNC_MOBILE_UPDATES=0 ECS_HOST=120.55.188.242 npm run deploy:aliyun` 部署 HEAD JAR；生产 jar (15:09) 含 R0.5 全部类 + capability-manifest.json，启动 0 error，health ok。
  - 前端 OTA: `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update` → `app-0.1.0-20260605151046.zip`；scp bundle + manifest 到 `/var/lib/.../mobile-updates/` 并 restart；旧 122812 保留回滚。
  - 按 AGENTS.md OTA 准则验证: bundle base URL 仅生产 IP、零 localhost；check API 返回 151046 + url + checksum；生产实际下载 checksum 逐字节匹配 `d44fe3f4…`；enabled=true。
- Known risks / 待办:
  - R0.5 隐私合规 (知情同意/脱敏/数据权利) 现已对生产用户暴露；如需暂缓可单独回退后端 JAR。
  - 端到端 agent smoke / 图片显示 (query token 媒体白名单) 未在真机验证，待用户 OTA 后确认。
  - 生产 `bundles/` 堆积约 100 个历史包，已 spawn 后台任务清理 + 加最近-N 保留策略。
  - 工作区未提交: `docs/agent-benchmark-results.md`、`harness/claude-progress.md`、`.claude/`。

### Session 2026-06-05 发布硬化改进方案详细 Spec

- Goal: 基于正式发布上架评估，把当前 App 需要改进和补充的点细化成单一 spec，继续保持“记录和陪伴”主线，不扩张电商、专家、知识付费或开放社区。
- Completed:
  - 新增 `docs/superpowers/specs/2026-06-05-release-readiness-improvement-design.md`，作为发布硬化改进方案 spec。
  - 将发布路径拆成 R0 内部开发态、R1 受控真实家庭内测、R2 渠道灰度/TestFlight、R3 公开上架和公开收费四个 gate。
  - 细化 P0 需求：短信验证码、登录风控、手机号和日志脱敏、query token 收敛、隐私/儿童信息/AI 数据说明、删除导出注销、真实 Pro entitlement、家庭级额度、HTTPS 域名、备份恢复、深度健康、监控告警、压测、真机验证和产品信任入口。
  - 明确 P1/P2：支付订阅、DB/Redis/队列/OSS/CDN 扩容、0-3 岁长期陪跑沉淀；这些不进入当前 P0。
- Verification run:
  - `bash harness/init.sh` 通过：`git diff --check`、`npm run build`、`npm run test:agent-benchmark`。
- Known risks:
  - 本轮只新增 spec 和 harness 记录，不包含代码实现、法务审查、真实支付、压测或真机验证。

### Session 2026-06-04 正式发布上架评估与补齐 Spec

- Goal: 基于当前“记录和陪伴”发展脉络，评估如果要正式发布上架，产品设计和技术层面还缺什么，重点覆盖账号体系、Free/Pro 分层、ECS 承载能力，并校准国内母婴 App 常见路线。
- Completed:
  - 新增 `docs/release-readiness-review-2026-06-04.md`，作为单一发布前评估文档。
  - 文档结论：当前适合继续邀请码/小范围真实家庭内测，不建议直接公开上架；正式上架前应先补短信验证码、手机号和日志脱敏、query token 收敛、隐私/儿童信息/删除导出、真实 Pro gating 和额度、HTTPS/备案/备份监控/压测、真机验证。
  - 竞品校准：国内头部普遍走记录工具 + 内容/社区/专家/电商/会员；小宝记只借鉴账号合规、会员说明、隐私和基础记录可靠性，不跟随电商、专家和开放社区。
  - ECS 判断：当前单 ECS + Spring Boot + SQLite WAL + local/OSS + OTA 适合 5-10 家庭内测和受控灰度；没有压测前不承诺公开流量承载。
- Verification run:
  - `bash harness/init.sh` 通过：`git diff --check`、`npm run build`、`npm run test:agent-benchmark`。
- Known risks:
  - 本轮是文档和策略评估，不包含代码实现、真实法务审查或压测。
  - `docs/agent-benchmark-results.md` 可能会因 harness 运行刷新时间戳；本轮发布评估不依赖该生成差异。

### Session 2026-06-04 AI Agent Benchmark 产品功能覆盖补缺

- Goal: 按用户反馈把 agent benchmark 的重点收敛为“覆盖产品功能”，补上成长数据维护、数据关联陪伴等近期新增能力的覆盖视角，而不是只测 agent 能不能返回结构化结果。
- Completed:
  - 新增 `docs/superpowers/plans/2026-06-04-agent-product-benchmark-coverage.md`，把产品功能域分成 L0/L1、L2 runnable、fixture skip、known product gap 四类。
  - 新增 `scripts/l2-benchmark/effect-apply.mjs`，让 L2 runner 在最后一次真实 stream 后模拟前端 apply effectDecision，通过 `PUT /api/app/state/{collection}/{id}` 写入 `careLogs`、`reminders`、`pendingEffects` 等集合，再做 app_state diff。
  - 修改 `scripts/agent-l2-benchmark.mjs`：每个 scenario 开始前独立 reset app_state；支持 `setupState` 预置 care/growth 数据；报告里展示 Applied effects，并把 known product coverage gaps 与普通 fixture skip 分开。
  - 扩展 `scripts/l2-benchmark/scenarios.mjs`：新增 `growth-milestone`（成长事件待确认）、`growth-measurement-complete`（身高/体重/头围维护待确认）、`daily-observation-context`（预置喝奶/睡眠/体重后做数据关联陪伴），并补入 `feed-mixed-missing-type`、`sleep-start-boundary`、`multi-care-events`、`vague-reminder-ask` 四个记录边界 L2 场景。
  - 补齐成长数据维护链路：`RecordSignalExtractor` 抽取身高/体重/头围，`EffectPolicy` 生成 pending `growthMeasurement`，前端 pending effect UI 可编辑确认，`AppStateService` 确认后写入共享 `growthMeasurements`。
  - 修复真实 L2 暴露的 `vague-reminder-ask` 红线：当模型只用自然语言追问、没有 reminder DTO 时，`EffectPolicy` 规则层兜底生成 `reminder/ask`，保证前端有稳定结构化语义。
  - 新增 `scripts/test-album-domain.mjs`，把聊天生活照 auto-save、截图 ignore、重复 attachment 去重纳入快速产品规则 benchmark。
  - 新增 `npm run test:agent-l2:unit`，覆盖 effect apply、产品功能覆盖矩阵和相册 domain 规则。
  - 继续补齐产品功能矩阵：`expense-record` 现在断言 `pendingEffects.expenses`；新增 `medicine-reminder-pending`、`vaccine-reminder-pending`、`growth-measurement-ambiguous-unit`、`memory-health-pending` 四个 L2 场景。
  - 新增确定性规则：体重缺单位时走 `growthMeasurement/ask`，显式“记住”健康线索走待确认 `memory`；`医生开的维生素D` 等用药表达进入 medicine risk，提醒保持 pending。
  - 修复真实 L2 暴露的成长单位红线：当模型把 `体重14` 误整理为成长事件时，`EffectPolicy` 在单位澄清场景下 suppress 模型 `growthEvent`，避免 pendingEffects 旁路写入。
  - 按用户反馈继续查漏补缺：新增偏好/照护人分工记忆规则，显式“记住小宝喜欢白噪音”和“爸爸哄睡、妈妈喂奶”都进入待确认 `memory`，不直接写长期记忆。
  - 将资料维护明确成 chat 边界：`把宝宝昵称改成桃桃` 只返回能力边界和资料页指引，不生成记录、pendingEffect 或长期记忆。
  - 扩展 L2 产品场景：`memory-preference-pending`、`memory-caregiver-pending`、`qa-care-allergy-context`、`caregiver-fatigue-context`、`profile-update-boundary`，覆盖偏好/照护人记忆、基于过敏记忆的育儿问答、低焦虑陪伴和资料修改边界。
  - 继续补齐成长和问答边界：异常成长测量值（如 `身高999cm`）走 `growthMeasurement/ask` 且不进入 pendingEffects；普通育儿问答（如 `宝宝不爱吃辅食怎么办`）不再误生成辅食 careLog 或模型 memory 草稿。
  - 新增 `growth-measurement-duplicate-known-gap`，把同日同类型同值成长数据重复维护显式标为 known gap；当前策略层没有 existing growthMeasurements 上下文，后续需要接入后才能从根上防重复。
  - 按用户再次反馈补齐“成长数据维护”产品面：新增 `growth-measurement-update-boundary`、`growth-measurement-delete-boundary` 两个 L2 场景，覆盖聊天里请求更正/删除已有成长测量时只给边界回应、不改删历史数据、不新增 pendingEffects。
  - 扩展 `AgentCapabilityContract`：把成长测量数据加入支持的待确认动作，同时把身高/体重/头围的历史更新/更正请求识别为 unsupported mutation；边界文案指向记录页/成长页手动编辑。
  - 新增 `AppStateControllerTests#upsertingAndDeletingGrowthMeasurementMaintainsSharedData`，覆盖成长页手动维护 API 的同 id 更新和删除。
  - 修复同日同类型同值成长数据重复维护 known gap：`AgentContextSnapshot` / `AgentContextService` 增加相关 `growthMeasurements`，普通 chat 与 stream 路径都传给 `EffectPolicy`；`今天体重还是7.4kg` 在已有今日体重 7.4kg 时返回 `growthMeasurement/ask` + `missingFields=["duplicate"]`，不新增 pending 草稿。
  - 将 L2 场景从 `growth-measurement-duplicate-known-gap` 升级为 runnable `growth-measurement-duplicate-boundary`，并扩展规则抽取支持“身高/体重/头围还是/仍是/依然是 X”。
  - 收紧重复成长数据的最终用户话术：当规则层已经判断为 `missingFields=["duplicate"]`，最终回复直接使用“今天已经有...”的边界问题，不再拼接模型草稿里的“再记一条”。
  - 新增 L2 `aiTextAssertions` 硬断言层：`scripts/l2-benchmark/assertions.mjs` 统一结构断言，`scripts/test-l2-assertions.mjs` 覆盖只读查询不能追加“我再帮你设置/这个提醒想定”。
  - 新增只读查询和私密状态边界 L2 场景：`read-only-reminder-list-context`、`read-only-growth-trend-context`、`private-reminder-share-boundary`。
  - 修复真实 L2 暴露的只读/私密话术问题：提醒列表查询不再因“提醒”关键词触发 vague reminder ask；个人提醒同步给全家返回确定性隐私边界文案，不承诺同步、不追问新提醒时间。
  - 新增只读日报/周报 L2 场景：`read-only-daily-summary-context`、`read-only-weekly-summary-context`，预置照护、成长和提醒数据后断言只读总结不新增 careLogs/growthMeasurements/reminders/pendingEffects/memories。
  - 修复真实 L2 暴露的只读总结话术问题：日报/周报查询不再因“奶量/睡眠”关键词触发 careLog ask，也不再给正确总结后追加“告诉我喝了多少 ml / 我再帮你记”。
  - 针对用户指出“成长数据维护怎么没看到”，重新跑通成长数据维护完整 L2 子集：新增待确认、单位不明、异常值、聊天改/删边界、重复值边界均可见且通过。
  - 将后端视觉/相册 L2 从占位升级为 runnable：`photo-album` 和 `screenshot-ignore` 使用内置 dataUrl fixture，不再依赖外部图片文件或 upload 预步骤。
  - 新增全产品 coverage index：`scripts/l2-benchmark/product-coverage-index.mjs` + `docs/agent-product-coverage-index.md`，把 `harness/feature_list.json` 每个 feature 映射到 L2、L0/L1、frontend、backend、cloud、native、docs 或 known-gap 证据层。
  - 新增 `scripts/test-agent-product-coverage-index.mjs` 并接入 `npm run test:agent-l2:unit`，防止后续新增产品 feature 但没有 benchmark/verification 归属。
  - 继续查漏补缺 `mobile-001`：新增 `scripts/native-capability-audit.mjs`、`scripts/test-native-capability-audit.mjs`、`docs/native-capability-benchmark.md`，把 ASR/通知/全屏响铃/haptics/原生媒体选择/OTA/安全区键盘拆成逐项 static evidence + device probe 合同。
  - 将 `test-native-capability-audit` 接入 `npm run test:agent-l2:unit`，并让 `docs/agent-product-coverage-index.md` 与 `scripts/l2-benchmark/product-coverage-index.mjs` 显式引用 capability ids，避免移动端能力再次变成模糊 known gap。
  - 继续把覆盖粒度从 `harness/feature_list.json` 下钻到 `docs/feature-inventory.md`：新增 `scripts/l2-benchmark/app-function-coverage-index.mjs`、`scripts/test-app-function-coverage-index.mjs`、`docs/app-function-coverage-index.md`，90 个 P0/P1/P2 功能场景均有 coverage owner 或 known gap。
  - 将 `test-app-function-coverage-index` 接入 `npm run test:agent-l2:unit`，防止后续 feature inventory 新增功能行但没有 benchmark/gate 归属。
  - 再次按用户反馈查漏补缺：将 `docs/feature-inventory.md` 增加独立“成长数据维护”功能域，并补上 `growthMeasurements` 属于家庭共享数据；行级覆盖从 90 行扩到 97 行。
  - 新增成长维护必备行：成长入口与最新值、手动新增成长测量、手动删除成长测量、成长测量编辑能力、AI 成长数据待确认、成长数据边界、成长趋势只读查询。
  - 扩展 `scripts/test-app-function-coverage-index.mjs`：如果成长维护核心行缺失，测试直接失败；`docs/app-function-coverage-index.md` 已明确每一行的 coverage owner 或 known gap。
  - 扩展 `scripts/frontend-smoke.mjs`：成长页 smoke 现在新增 68.2cm 后删除该历史行，并断言删除后不再出现，覆盖成长测量手动删除前端路径。
  - 继续关闭成长维护剩余缺口：`GrowthEntryView` 历史测量行新增“编辑”操作，保存复用同 id upsert；`scripts/frontend-smoke.mjs` 覆盖 66.5cm 编辑为 67.1cm、备注更新、旧行消失。
  - 将 `成长测量编辑能力` 从 app-function known gap 升级为 `covered_by_layer(frontend, backend)`，当前行级覆盖统计变为 97 rows：`covered=15`、`covered_by_layer=52`、`known_gap=30`。
- Verification run:
  - RED: `node scripts/test-app-function-coverage-index.mjs` 失败于缺少 `scripts/l2-benchmark/app-function-coverage-index.mjs`。
  - GREEN: `node scripts/test-app-function-coverage-index.mjs`，输出 `app function coverage index tests passed: 90 inventory rows covered`。
  - GREEN: `node scripts/l2-benchmark/app-function-coverage-index.mjs`，统计 90 rows：`covered=12`、`covered_by_layer=48`、`known_gap=30`。
  - GREEN: `npm run test:agent-l2:unit` 包含 `test-app-function-coverage-index` 后通过。
  - GREEN: `npm run test:agent-benchmark`
  - GREEN: `bash harness/init.sh` after app function coverage index integration passed `git diff --check`, `npm run build`, and `npm run test:agent-benchmark`.
  - RED: `node scripts/test-native-capability-audit.mjs` 失败于缺少 `scripts/native-capability-audit.mjs`。
  - GREEN: `node scripts/test-native-capability-audit.mjs`
  - GREEN: `npm run test:agent-l2:unit`
  - GREEN: `bash harness/init.sh` after native capability audit integration passed `git diff --check`, `npm run build`, and `npm run test:agent-benchmark`.
  - RED: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" /Applications/IntelliJ\ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn -f backend/pom.xml -Dtest=AgentBenchmarkTests#benchmarkDuplicateGrowthMeasurementAsksWithoutPendingDraft test -q` 失败于 `EffectPolicy.decide` 缺少 existing growthMeasurements 参数；修复后再次失败于“体重还是7.4kg”未被抽取，随后补 regex。
  - RED: `node scripts/test-l2-coverage-matrix.mjs` 失败于 `growth-measurement-duplicate-known-gap` 仍为 `skip=true`。
  - GREEN: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" /Applications/IntelliJ\ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn -f backend/pom.xml -Dtest=AgentBenchmarkTests#benchmarkDuplicateGrowthMeasurementAsksWithoutPendingDraft test -q`
  - GREEN: `node scripts/test-l2-coverage-matrix.mjs`
  - `L2_BASE_URL=http://localhost:8080 L2_INVITE_CODE=353541 L2_TEST_PHONE=13800009992 L2_TEST_ROLE=妈妈 npm run test:agent-l2 -- --only growth-measurement-duplicate-boundary --runs 1`
  - GREEN: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" /Applications/IntelliJ\ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn -f backend/pom.xml -Dtest=AgentBenchmarkTests#benchmarkDuplicateGrowthMeasurementReplyDoesNotInviteDuplicateRecord test -q`
  - RED: `node scripts/test-l2-assertions.mjs` 失败于缺少 `scripts/l2-benchmark/assertions.mjs`。
  - RED: `L2_BASE_URL=http://localhost:8080 L2_INVITE_CODE=353541 L2_TEST_PHONE=13800009992 L2_TEST_ROLE=妈妈 npm run test:agent-l2 -- --only read-only-reminder-list-context,read-only-growth-trend-context,private-reminder-share-boundary --runs 1` 失败于只读提醒查询追加“这个提醒想定在什么时候/我再帮你设置”，私密同步边界出现“我会把...同步给全家”。
  - RED: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" /Applications/IntelliJ\ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn -f backend/pom.xml -Dtest=AgentBenchmarkTests#benchmarkReadOnlyReminderListDoesNotAppendReminderCreationAsk+benchmarkPrivateReminderShareBoundaryDoesNotPromiseSyncOrAskTime test -q` 失败于 `RecordSignals` 缺少 `readOnlyReminderQuery()` / `privateStateShareRequest()`。
  - GREEN: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" /Applications/IntelliJ\ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn -f backend/pom.xml -Dtest=AgentBenchmarkTests#benchmarkReadOnlyReminderListDoesNotAppendReminderCreationAsk+benchmarkPrivateReminderShareBoundaryDoesNotPromiseSyncOrAskTime test -q`
  - GREEN: `L2_BASE_URL=http://localhost:8080 L2_INVITE_CODE=353541 L2_TEST_PHONE=13800009992 L2_TEST_ROLE=妈妈 npm run test:agent-l2 -- --only read-only-reminder-list-context,read-only-growth-trend-context,private-reminder-share-boundary --runs 1`
  - RED: `node scripts/test-l2-coverage-matrix.mjs` 失败于缺少 `read-only-daily-summary-context`。
  - RED: `L2_BASE_URL=http://localhost:8080 L2_INVITE_CODE=353541 L2_TEST_PHONE=13800009992 L2_TEST_ROLE=妈妈 npm run test:agent-l2 -- --only read-only-daily-summary-context,read-only-weekly-summary-context --runs 1` 失败于日报被误判为喂养缺字段追问，周报尾部追加“告诉我喝了多少 ml / 我再帮你记”。
  - RED: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" /Applications/IntelliJ\ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn -f backend/pom.xml -Dtest=AgentBenchmarkTests#benchmarkReadOnlyDailySummaryDoesNotAppendCareLogAsk+benchmarkReadOnlyWeeklySummaryDoesNotAppendCareLogAsk test -q` 失败于 `RecordSignals` 缺少 `readOnlySummaryQuery()`。
  - GREEN: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" /Applications/IntelliJ\ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn -f backend/pom.xml -Dtest=AgentBenchmarkTests#benchmarkReadOnlyDailySummaryDoesNotAppendCareLogAsk+benchmarkReadOnlyWeeklySummaryDoesNotAppendCareLogAsk test -q`
  - GREEN: `node scripts/test-l2-coverage-matrix.mjs`
  - GREEN: `L2_BASE_URL=http://localhost:8080 L2_INVITE_CODE=353541 L2_TEST_PHONE=13800009992 L2_TEST_ROLE=妈妈 npm run test:agent-l2 -- --only read-only-daily-summary-context,read-only-weekly-summary-context --runs 1`
  - RED: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" /Applications/IntelliJ\ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn -f backend/pom.xml -Dtest=AgentBenchmarkTests#benchmarkGrowthMeasurementHistoryUpdateStaysBoundaryOnly test -q` 失败于 `unsupportedMutationRequest=false`。
  - RED: `node scripts/test-l2-coverage-matrix.mjs` 失败于缺少 `growth-measurement-update-boundary`。
  - GREEN: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" /Applications/IntelliJ\ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn -f backend/pom.xml -Dtest=AgentBenchmarkTests#benchmarkGrowthMeasurementHistoryUpdateStaysBoundaryOnly+benchmarkGrowthMeasurementHistoryDeleteStaysBoundaryOnly test -q`
  - GREEN: `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" /Applications/IntelliJ\ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn -f backend/pom.xml -Dtest=AppStateControllerTests#upsertingAndDeletingGrowthMeasurementMaintainsSharedData test -q`
  - GREEN: `node scripts/test-l2-coverage-matrix.mjs`
  - `L2_BASE_URL=http://localhost:8080 L2_INVITE_CODE=353541 L2_TEST_PHONE=13800009992 L2_TEST_ROLE=妈妈 npm run test:agent-l2 -- --only growth-measurement-update-boundary,growth-measurement-delete-boundary --runs 1`
  - `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" /Applications/IntelliJ\ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn -f backend/pom.xml -Dtest=AgentBenchmarkTests test -q`
  - `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" /Applications/IntelliJ\ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn -f backend/pom.xml -Dtest=AppStateControllerTests test -q`
  - `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin:$PATH" /Applications/IntelliJ\ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn -f backend/pom.xml -Dtest=AuthControllerTests test -q`
  - `npm run test:agent-l2:unit`
  - `npm run test:agent-benchmark`
  - `L2_BASE_URL=http://localhost:8080 L2_INVITE_CODE=353541 L2_TEST_PHONE=13800009992 L2_TEST_ROLE=妈妈 npm run test:agent-l2 -- --only feed-complete,feed-mixed-missing-type,sleep-start-boundary,multi-care-events,vague-reminder-ask,growth-milestone,growth-measurement-complete,daily-observation-context --runs 1`
  - `L2_BASE_URL=http://localhost:8080 L2_INVITE_CODE=353541 L2_TEST_PHONE=13800009992 L2_TEST_ROLE=妈妈 npm run test:agent-l2 -- --only expense-record,growth-measurement-ambiguous-unit,memory-health-pending,medicine-reminder-pending,vaccine-reminder-pending --runs 1`（第一次暴露 `growth-measurement-ambiguous-unit` execution red-line，修复后 5/5 通过）
  - `L2_BASE_URL=http://localhost:8080 L2_INVITE_CODE=353541 L2_TEST_PHONE=13800009992 L2_TEST_ROLE=妈妈 npm run test:agent-l2 -- --only memory-preference-pending,memory-caregiver-pending,qa-care-allergy-context,caregiver-fatigue-context,profile-update-boundary --runs 1`
  - `L2_BASE_URL=http://localhost:8080 L2_INVITE_CODE=353541 L2_TEST_PHONE=13800009992 L2_TEST_ROLE=妈妈 npm run test:agent-l2 -- --only growth-measurement-out-of-range,qa-care-no-memory-pollution,growth-measurement-duplicate-known-gap --runs 1`
  - `npm run verify:frontend`
  - `curl -fsS -m 3 http://localhost:8300/api/auth/invite/roles?inviteCode=ping`（本地 backend 未启动）
  - `curl -fsS -m 3 http://localhost:8080/api/auth/invite/roles?inviteCode=ping`（本地 backend 未启动）
  - `bash harness/init.sh`（通过 `git diff --check`、`npm run build`、`npm run test:agent-benchmark`）
  - `bash harness/init.sh`（在只读日报/周报补缺后再次通过 `git diff --check`、`npm run build`、`npm run test:agent-benchmark`）
  - RED: `node scripts/test-l2-coverage-matrix.mjs` 失败于 `photo-album` 仍为 `skip=true`。
  - GREEN: `npm run test:agent-l2:unit`
  - GREEN: `L2_BASE_URL=http://localhost:8080 L2_INVITE_CODE=353541 L2_TEST_PHONE=13800009992 L2_TEST_ROLE=妈妈 npm run test:agent-l2 -- --only growth-measurement-complete,growth-measurement-ambiguous-unit,growth-measurement-out-of-range,growth-measurement-update-boundary,growth-measurement-delete-boundary,growth-measurement-duplicate-boundary,photo-album,screenshot-ignore --runs 1`
  - RED: `node scripts/test-agent-product-coverage-index.mjs` 失败于缺少 `scripts/l2-benchmark/product-coverage-index.mjs`。
  - GREEN: `node scripts/test-agent-product-coverage-index.mjs`
  - GREEN: `npm run test:agent-l2:unit`
  - RED: `node scripts/test-app-function-coverage-index.mjs` 失败于缺少 `P0:成长入口与最新值`，证明 feature inventory / coverage index 没有显式成长维护行。
  - GREEN: `node scripts/test-app-function-coverage-index.mjs`，输出 `app function coverage index tests passed: 97 inventory rows covered`。
  - GREEN: `node scripts/l2-benchmark/app-function-coverage-index.mjs`，统计 97 rows：`covered=15`、`covered_by_layer=51`、`known_gap=31`。
  - GREEN: `npm run test:agent-l2:unit` 包含 97-row app function coverage index 后通过。
  - GREEN: `npm run verify:frontend` 通过桌面和 6 个移动视口；成长 smoke 覆盖异常值拒绝、有效测量新增、备注展示和新增行删除。
  - RED: `npm run smoke:frontend` 失败于 `.growth-history li` 中找不到 `编辑` 按钮，证明成长测量编辑入口缺失。
  - GREEN: `npm run smoke:frontend` 通过桌面和 6 个移动视口；成长 smoke 覆盖历史测量编辑、异常值拒绝、有效测量新增和新增行删除。
  - GREEN: `npm run verify:frontend` 通过：`npm run build` + `npm run smoke:frontend`，桌面和 6 个移动视口均通过成长测量编辑/新增/删除 smoke。
- Evidence:
  - `npm run test:agent-l2:unit` 通过：`L2 effect apply tests passed`、`L2 coverage matrix tests passed`、`album domain tests passed`。
  - `npm run test:agent-benchmark` 通过 41 tests，`docs/agent-benchmark-results.md` 已更新，新增偏好/照护人记忆待确认、资料修改边界、异常成长值 ask、普通问答 no-memory/no-careLog、成长维护 update/delete chat 边界、成长重复维护 ask/no-write、重复成长数据最终话术不邀请“再记一条”、只读提醒列表不追加新建提醒追问、私密提醒同步边界不承诺同步，并保留健康记忆、健康提醒 pending、成长体重单位歧义 case。
  - 新增 targeted evidence：成长维护 update/delete chat 边界 L1 通过，成长页手动 `growthMeasurements` update/delete API 通过，L2 coverage matrix 已要求 `growth-measurement-update-boundary` / `growth-measurement-delete-boundary`。
  - 此前成长/问答边界批次真实 L2 2/2 runnable 通过，覆盖异常成长值 ask/no pendingEffects、普通辅食问答 no-mutation；当时 `growth-measurement-duplicate-known-gap` 作为 known gap 展示，后续已升级为 runnable `growth-measurement-duplicate-boundary`。
  - `docs/agent-l2-benchmark-results.md` 已刷新为真实 L2 PASS：`growth-measurement-update-boundary`、`growth-measurement-delete-boundary` 2/2 通过；两者均预置已有成长数据后验证 `growthMeasurements` 不增长（1→1）、`pendingEffects` 不增长（0→0），judge 5/5。
  - `docs/agent-l2-benchmark-results.md` 已刷新为真实 L2 PASS：`growth-measurement-duplicate-boundary` 1/1 通过；结构断言命中 `growthMeasurement/ask`、`missingFields.0=duplicate`，并验证 `growthMeasurements` 1→1、`pendingEffects` 0→0，judge 5/5。
  - `docs/agent-l2-benchmark-results.md` 已刷新为真实 L2 PASS：`read-only-reminder-list-context`、`read-only-growth-trend-context`、`private-reminder-share-boundary` 3/3 通过；新增 aiText hard assertions 断言不出现“这个提醒想定/我再帮你设置/我会把/已同步”，并验证 `reminders`、`growthMeasurements`、`pendingEffects`、`memories` 不误增长。
  - `docs/agent-l2-benchmark-results.md` 已刷新为真实 L2 PASS：`read-only-daily-summary-context`、`read-only-weekly-summary-context` 2/2 通过；新增 aiText hard assertions 断言出现 240/3/480/7.4 等 seeded 数据，且不出现“我再帮你记/喝了多少 ml”，并验证 `careLogs`、`growthMeasurements`、`reminders`、`pendingEffects`、`memories` 不误增长。
  - `docs/agent-l2-benchmark-results.md` 已刷新为真实 L2 PASS：成长维护 + 视觉/相册补缺批次 8/8 通过。成长数据维护 6 个场景覆盖 pending 新增、缺单位 ask、异常值 ask、聊天 update/delete 边界、重复值 ask/no-write；`photo-album` 验证 `albumItems` 0→1 且不新增 care/growth/pending/memory；`screenshot-ignore` 验证 `albumItems`、`pendingEffects` 与其他记录集合均 0→0。
  - `docs/agent-product-coverage-index.md` 已记录全产品覆盖归属：Agent L2、前端 smoke、AppState controller tests、cloud E2E/native builds/ProTrial tests 分层清楚；`mobile-001` 的 ASR/通知/全屏响铃/haptics/WebView-only 行为保留为 device/native known gap。
  - `docs/native-capability-benchmark.md` 已记录 `mobile-001` 的逐项 native capability audit：`asr-voice-input`、`local-notifications`、`full-screen-ringing`、`haptics`、`native-media-picker`、`ota-updater`、`safe-area-keyboard`；`node scripts/test-native-capability-audit.mjs` 通过。
  - `docs/app-function-coverage-index.md` 已记录 90 个 `docs/feature-inventory.md` 功能场景：12 个 covered、48 个 covered_by_layer、30 个 known_gap；`node scripts/test-app-function-coverage-index.mjs` 通过。
  - `docs/feature-inventory.md` 已拆出独立“成长数据维护”功能域，并把 `growthMeasurements` 写入家庭共享数据；`docs/app-function-coverage-index.md` 已更新为 97 个功能场景：15 个 covered、52 个 covered_by_layer、30 个 known_gap。
  - 成长维护现在人读可见：入口/最新值、手动新增、手动编辑、手动删除、AI 待确认、单位/异常/重复/改删边界、只读趋势查询均有覆盖归属。
  - `npm run test:agent-l2:unit` 已包含 `test-agent-product-coverage-index`、`test-native-capability-audit`、`test-app-function-coverage-index` 并通过。
  - App function coverage index 接入后，`bash harness/init.sh` 通过：`git diff --check`、`npm run build`、`npm run test:agent-benchmark`。
  - Native capability audit 接入后，`bash harness/init.sh` 通过：`git diff --check`、`npm run build`、`npm run test:agent-benchmark`。
  - `npm run test:agent-benchmark` 通过 43 tests，新增只读日报/周报不追加 careLog ask 的 L1 回归覆盖，`docs/agent-benchmark-results.md` 已更新。
  - 只读日报/周报补缺后，`bash harness/init.sh` 通过：`git diff --check`、`npm run build`、`npm run test:agent-benchmark`；`harness/feature_list.json` JSON.parse 通过，8080 无监听进程遗留。
  - `AppStateControllerTests` 已覆盖确认 pending `growthMeasurements` 后写入共享成长数据，以及手动维护同 id 更新/删除；`npm run verify:frontend` 已通过桌面和 6 个移动 viewport smoke。
  - `docs/superpowers/specs/2026-06-04-agent-capability-benchmark.md` 的核心场景表已补入成长事件、成长数据维护 runnable case、成长异常值边界、成长维护 update/delete chat 边界、成长重复维护 no-write 边界、数据关联陪伴、记忆细分、资料边界、普通问答 no-memory 和基于记忆的育儿问答。
  - `harness/feature_list.json` 已记录 L2 benchmark infrastructure 的 fast gate。
  - 新增健康记忆/健康提醒/成长单位边界后，`bash harness/init.sh` 再次通过：`git diff --check`、`npm run build`、`npm run test:agent-benchmark`。
- Known risks:
  - 后端视觉 L2 已 unskip：`photo-album` / `screenshot-ignore` 使用内置 dataUrl fixture 通过；仍待补“保存 previous video 到相册”的多轮附件 hydration 场景。
  - 成长数据维护已覆盖新增待确认、确认写入、手动前端新增/编辑/删除、手动 API 更新/删除、缺体重单位 ask、异常值 ask、聊天 update/delete 边界、同日同类型同值重复维护 ask/no-write。
  - 只读产品查询已覆盖提醒列表、成长趋势、今日总结和周趋势；后续可补日报/周报 UI 层 probe 与 conversationSummary API 只读边界。
  - 记忆能力已有显式健康/偏好/照护人 pending 正向场景，普通问答不误写 memory 也已覆盖；私密提醒同步边界已覆盖，但跨用户/只读角色云端隔离仍需单独 cloud L2。
  - `mobile-001` 现在有 static/native capability audit，但仍不是设备通过证据；ASR 录音转写、通知送达、全屏响铃、haptics 触感、原生媒体选择、OTA apply、WebView 键盘/安全区仍需 iOS/Android 真机 probe。
  - 最新 L2 中偏好/照护人记忆的 judge JSON 偶发不可解析，但结构化断言和 app_state 执行均 PASS；后续可增强 judge 输出约束。
  - 工作区已有 AuthService/AuthControllerTests 本地改动（占位家庭照护人升级逻辑）不是本轮改动；后续合入前需确认登录页 existingMember 不要求角色选择时的兼容性。

### Session 2026-06-04 生产问题修复：聊天照片自动收藏 + OTA 瘦身 + 相册数据修复

- Goal: 修复用户反馈的 3 个生产问题（聊天发的照片没进相册、上传后等 AI 很久才进相册、最新 OTA 包太大下载慢），并修复用户 137****2890 已丢失的相册数据。
- 根因（systematic-debugging Phase 1，生产数据确认）:
  - 问题 1+2 同源：聊天发的生活照走 `ask` 模式生成「点击保存」卡片，且卡片挂在 AI 响应消息上要等豆包视觉分析；后端 AI 回复「已经为你记录下成长瞬间」擦边误导用户以为已存。用户没点保存 → 没进相册。5/29 该用户发的照片里只有手动点了保存的 1 张进相册。
  - 问题 3：mobile bundle 3.2M 里 alarm-scene.png(1.6M) + hero-records-today.png(524K) 两张未压缩 PNG 占 60%。
- Completed:
  - 问题 1+2（commit `2000c14`）：`albumDomain.ts` 把非截图的生活照默认从 ask 改为 `auto_save`；`App.tsx` 发送瞬间对 auto_save 的图乐观即时进相册（不等 AI、不需手动点），服务端 albumItem effectDecision 按 attachmentId 去重，补正向反馈「照片已放进成长相册」；后端 `AgentPrompts` 改成客观描述图片内容、禁止「已记录下成长瞬间/已收藏/已留存」等暗示已存的措辞。
  - 问题 3（commit `029ac8f`，后台 agent 完成）：alarm-scene/hero 转 WebP（-95%/-90%），mobile bundle 3.2M→1.2M（-63%）。
  - 数据修复：备份生产库后，为 family-eb3f4751 补建 5 条 album_item——3 张照片（长湿疹/玩气球/成长素材）+ 2 个视频（软乎乎的小手/玩气球），album_item 46→51；监控摄像头 App 截图（smarteye）按既有截图规则不补。
- Verification run:
  - `npm run build` + `npm run smoke:frontend`（7 视口）
  - 后端 IDEA mvn 编译 + `npm run test:agent-benchmark`（26 PASS）
  - 云端 `/api/health` ok + OTA check 返回新版本
- Deploy: OTA `0.1.0-20260604002926`（前端 OTA 含照片自动收藏+WebP瘦身 + 后端 rebuild 含措辞），`SYNC_DATA=0`，云端 health ok，已 push origin main。
- 生产数据备份:
  - `baby-companion.sqlite.before-album-restore-20260604005557`（补照片前）
  - `baby-companion.sqlite.before-video-restore-20260604010002`（补视频前）
- Known risks:
  - 相册自动收藏的真机行为待用户真机确认（mock 测不了真实「发图→进相册→AI 措辞」链路）。
  - 「AI 回复本身慢」（豆包视觉串行分批）未解决，待 agent 全链路耗时审计单独立项（已摸清链路：planner + 视觉串行 + final composer，视觉是大头）。
  - 补建的 album_item 是家庭共享数据，用户下次打开 App 拉 app state 即可见。

### Session 2026-06-02 Recording Companion P1 Implementation, Git Sync, ECS And OTA

- Goal: 按用户要求实现 P1，并同步 Git、ECS 远端和 OTA 包；继续保持“记录为基线、低焦虑反疲劳设计、数据关联陪伴、不做专家/知识付费/电商/社区”的产品边界。
- Completed:
  - 新增 implementation plan `docs/superpowers/plans/2026-06-02-recording-companion-p1-implementation.md` 并按任务勾选。
  - 扩展 `scripts/test-daily-summary-utils.mjs`，先验证 P1 helper 缺失失败，再实现并通过。
  - 在 `frontend/src/utils/dailySummary.ts` 增加 `buildCaregiverCompanionLine` 和 `buildHandoffSummary`，只基于真实 care/growth/reminder/pending/observation 数据生成低焦虑陪伴句和交接摘要。
  - 在 `DailySummaryView` 中新增 `给照护人的话`、`这些观察怎么来的` disclosure、`今日交接` 分组摘要和 `复制交接`；`App.tsx` 接入 reminders、pendingEffectCount 和剪贴板复制反馈。
  - 更新 `daily-summary.css`，让 P1 note、解释入口和交接卡片在移动视口内稳定排版。
  - 扩展 `scripts/probe-daily-summary-view.mjs`：断言 P1 文案，并额外截取交接区滚动位置。
  - 修复 `scripts/frontend-smoke.mjs` 中固定 `2026-05-19` 未来提醒随日期漂移变过期的问题，并把提醒页断言收紧到 `.reminder-group-upcoming .reminder-item`。
  - 在 `AgentPrompts` 增加照护人疲惫/自责/无助的非诊断陪伴边界，以及自伤/伤害宝宝等高风险线下求助边界；`AgentBenchmarkTests` 增加对应 prompt benchmark。
  - 构建并部署 OTA `0.1.0-20260602232444` 到 `120.55.188.242:8300`，生产数据同步保持 `SYNC_DATA=0`。
- Verification run:
  - `node scripts/test-daily-summary-utils.mjs`（先失败于 P1 helper 未导出，后通过）
  - `npm run build`
  - `npm run test:agent-benchmark`（先失败于 prompt 缺少边界，后 26 tests 通过）
  - `node scripts/probe-daily-summary-view.mjs`
  - `npm run verify:frontend`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 MOBILE_UPDATE_MESSAGE='小宝今日观察升级：陪伴一句话、今日交接、记录反馈' npm run build:mobile:update`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Production probe: `GET /api/health`, `POST /api/mobile-updates/check` for old/current bundle versions, and bundle checksum download verification.
- Evidence:
  - Probe 截图：`.verification/daily-summary-probe/iphone-13-390x844-1-records-today.png` 显示 P1 首屏陪伴句；`.verification/daily-summary-probe/iphone-13-390x844-1b-records-handoff.png` 显示 `今日交接` 分组摘要和 `复制交接`。
  - `npm run verify:frontend` 通过 desktop + 6 个移动视口 smoke。
  - `npm run test:agent-benchmark` 通过 26 tests，`docs/agent-benchmark-results.md` 已更新。
  - 生产 `http://120.55.188.242:8300/api/health` 返回 `ok`。
  - 生产 OTA check 对旧 bundle 返回 `updateAvailable=true`、版本 `0.1.0-20260602232444`；对当前 bundle 返回 `updateAvailable=false`。
  - 生产 OTA bundle 下载 3321376 bytes，sha256 `087927a33177c969182f89e5c551769b2dd75a11ec68d839147e4d415b4460b2` 与 manifest 匹配。
- Known risks:
  - P1 Agent 情感陪伴目前是 prompt/benchmark 边界，不是独立风险分类器；真实模型输出仍需后续线上观察。
  - 本轮发布的是 Web/OTA 和后端 prompt 更新；未做 native `mobile:sync` 或 iOS/Android debug build，因为没有改 Capacitor/native 配置、权限或 WebView-only 逻辑。

### Session 2026-06-02 Recording Companion P0 Implementation

- Goal: 按 `docs/superpowers/specs/2026-06-02-recording-companion-improvements-design.md` v2 启动 P0 实现，让记录页 today 视图出现单一 `小宝今日观察` 主入口，并强化记录后反馈。
- Completed:
  - 新增 implementation plan `docs/superpowers/plans/2026-06-02-recording-companion-p0-implementation.md`。
  - 新增纯函数测试脚本 `scripts/test-daily-summary-utils.mjs`，先验证 helper 缺失失败，再实现并通过。
  - 在 `frontend/src/utils/dailySummary.ts` 增加 `buildCareStats`、`buildGrowthStats`、`countTodayDataPoints`、`summarizeCareLogEffect`。
  - 扩展 `DailySummaryView` 为 `小宝今日观察`：无 summary 也展示主卡，接入 careLog/growthMeasurements/date/babyNickname/canCaregive/missing actions，展示喂养/睡眠/护理/成长 stat cards，并合入 `整理今天/重新整理`。
  - 移除记录页 today 视图中重复的 `Pro 今日小结` 主卡，保留现有生成、missing dismiss/mute、只读约束。
  - 聊天自动记录反馈改为 `已记好`，展示结构化摘要、去向说明、`查看今天` 和 `撤销`。
  - 更新 `scripts/probe-daily-summary-view.mjs`：fixture 注入 careLog/growthMeasurements，断言 `小宝今日观察`、stat cards、无旧 Pro/生成文案，并修复 probe import/shell wrapper 导致的副作用和退出问题。
- Verification run:
  - `bash harness/init.sh`（开工 baseline，通过 `git diff --check`、`npm run build`、`npm run test:agent-benchmark`）
  - `node scripts/test-daily-summary-utils.mjs`（先失败于 helper 未导出，后通过）
  - `npm run build`
  - `node scripts/probe-daily-summary-view.mjs`
  - `npm run verify:frontend`
  - `npm run test:agent-benchmark`
  - `git diff --check`
- Evidence:
  - Probe 截图：`.verification/daily-summary-probe/iphone-13-390x844-1-records-today.png` 显示 `小宝今日观察`、13 条记录、4 张 stat cards、`重新整理`，且页面下方露出 findings。
  - `npm run verify:frontend` 通过 desktop + 6 个移动视口 smoke。
  - `git diff --check` 通过，`harness/feature_list.json` 可被 JSON.parse。
- Known risks:
  - 本轮实现 P0 主闭环；P1 的数据关联陪伴一句话、今日交接摘要和 AI 隐私说明入口尚未实现。
  - 聊天 `已记好` 卡片目前覆盖自动写入 careLog 的 undo 流；提醒/账本等更完整的分类型记录反馈仍需后续包扩展。

### Session 2026-06-02 Recording Companion Improvements Spec

- Goal: 基于 `harness/app-development-roadmap.md` 和当前 App 实现事实，梳理记录与低焦虑陪伴主线下需要改进和补充的点，并整理成 spec。
- Completed:
  - 核对当前实现：聊天自动/待确认记录、DailySummaryView、Pro 今日小结、成长记录 MVP、Agent 医疗边界和 Daily Summary validator。
  - 新增并细化 spec `docs/superpowers/specs/2026-06-02-recording-companion-improvements-design.md`（v2）。
  - Spec 覆盖 P0/P1：`小宝今日观察` 主卡片、宝宝今天 stat cards、聊天记录成功反馈、反疲劳文案、数据关联陪伴一句话、今日交接摘要、隐私与 AI 使用说明。
  - v2 补充用户旅程、页面状态矩阵、stat card 数据映射、记录反馈卡片类型、文案审计清单、P1 高风险边界、埋点指标、UI probe 场景和 5 个 implementation 拆包建议。
  - 明确非目标：专家/知识付费、电商、开放社区、成长曲线/百分位、睡眠预测、心理诊疗、复杂权限、PDF 儿保资料包、孕期到 3 岁全量扩展。
- Verification run:
  - `bash harness/init.sh`（通过 `git diff --check`、`npm run build`、`npm run test:agent-benchmark`）
  - `git diff --check`
  - `rg -n "TODO|TBD|FIXME|待填|占位|不确定|暂定|xxx|\?\?" docs/superpowers/specs/2026-06-02-recording-companion-improvements-design.md`（唯一命中为“不要强行占位”的普通用词）
- Evidence:
  - Spec 当前只引用 `harness/app-development-roadmap.md` 作为战略源，未从 archive 直接取方向。
- Known risks:
  - 本轮只产出 spec，未进入 implementation plan 或代码实现。

### Session 2026-06-02 Research Archive And Roadmap Promotion

- Goal: 将历史调研/竞品/市场/战略草稿统一归档，只保留当前发展脉络在核心 harness，避免后续 agent 把旧研究结论当成当前方向。
- Completed:
  - 将当前战略源迁移到 `harness/app-development-roadmap.md`。
  - 将历史调研与草稿集中归档到 `docs/research-archive/mother-baby-strategy-2026-06-02/`，并新增 `README.md` 索引和读取规则。
  - 归档范围包括 Claude market/cross-app research、Codex 竞品调研与 slide、未跟踪战略草稿、以及含市场/竞品调研的成长指标旧未来设计。
  - 更新 `harness/README.md` 与 `harness/feature_list.json`，声明 `app-development-roadmap.md` 是当前产品方向 source of truth。
  - 更新历史 AI hub 计划，要求执行前按当前 roadmap Phase 0 校准；该计划现已归档到 `docs/archive/completed-2026-06-05/2026-06-01-daily-summary-ai-hub.md`。
- Verification run:
  - `bash harness/init.sh`（通过 `git diff --check`、`npm run build`、`npm run test:agent-benchmark`）
  - `git diff --check`
- Evidence:
  - Archive index: `docs/research-archive/mother-baby-strategy-2026-06-02/README.md`
- Known risks:
  - 历史文件被移动，旧路径不再可直接读取；需要从 archive index 或当前 roadmap 进入。

### Session 2026-06-02 Recording Companion Development Plan

- Goal: 重点复核 Claude 的 `2026-06-01-market-landscape-positioning.md`，结合 `2026-06-01-cross-app-design-review.md`、Codex 竞品调研和用户最新取舍，形成新的产品发展规划。
- Completed:
  - 对齐并修正 market 文档：保留“中文 AI 情感陪伴 × baby 数据关联”和“反记录疲劳陪伴叙事”，但明确情感陪伴不是心理治疗、专家咨询或知识付费。
  - 将“跨域洞察”从独立卖点降为陪伴和反疲劳体验的支撑能力，避免做成用户无感的技术展示。
  - 明确专家 IP、知识付费、电商不做；社区仅远期观察；孕期到 3 岁延展放到主线验证后。
  - 新增发展规划文档，后续迁移为 `harness/app-development-roadmap.md`。
- Verification run:
  - `bash harness/init.sh`（通过 `git diff --check`、`npm run build`、`npm run test:agent-benchmark`）
- Evidence:
  - 新文档推荐 Phase 0 先做 `小宝今日观察` 品牌化、反疲劳文案、聊天记录成功反馈、stat cards、成长最新值接入。
- Known risks:
  - 本轮仍是战略和产品规划，未进入 UI/后端实现。
  - 原未跟踪草稿已归档为 `docs/research-archive/mother-baby-strategy-2026-06-02/2026-06-02-product-strategy-roadmap-draft.md`。

### Session 2026-06-02 Mother-Baby Competitor Research And Strategy Deck

- Goal: 复核 Claude 近期母婴竞品调研，不直接复述其结论；独立 fan-out 国内/海外/策略/代码现状调研，聚焦“记录和陪伴”而非电商，并整合成可执行的产品方向。
- Completed:
  - 并行调研国内竞品（亲宝宝、宝宝树孕育、育学园、妈妈网孕育、时光小屋、小豆苗）和海外竞品（Baby Tracker、Huckleberry、Glow Baby、The Wonder Weeks、FamilyAlbum、What to Expect、BabyCenter）。
  - 核对 Claude 的 `2026-06-01-cross-app-design-review` 与 `daily-summary-ai-hub` plan，保留“AI 中枢/今日发现品牌化/stat cards/成长最新值接入”的精华，并补充家庭私域、儿保资料包、隐私信任、家庭角色权限和焦虑边界。
  - 落地详细调研文档，后续归档为 `docs/research-archive/mother-baby-strategy-2026-06-02/mother-baby-competitor-research-2026-06-02.md`。
  - 落地本地 HTML slide deck，后续归档为 `docs/research-archive/mother-baby-strategy-2026-06-02/mother-baby-strategy-2026-06-02-slides.html`。
- Verification run:
  - `bash harness/init.sh`（开工 baseline，通过 `git diff --check`、`npm run build`、`npm run test:agent-benchmark`）
  - 静态 slide 校验：10 个 slide、2 张本地图片均存在、无重复 slide id、包含键盘翻页和移动端媒体查询。
- Evidence:
  - 详细来源链接已写入调研文档 §16。
  - 推荐第一轮产品主题为“小宝今日观察：AI 中枢 + 家庭交接 + 成长最新值”。
- Known risks:
  - 本轮没有真机安装国内外竞品，证据主要来自公开 App Store、官网、帮助中心、隐私政策和仓库代码。
  - in-app Browser 拒绝直接打开 `file://` 本地 HTML（URL 安全策略），因此 slide 未做浏览器截图验证；已完成静态资源和结构校验。

### Session 2026-06-01 Merge Growth MVP To Main

- Goal: 将远端分支 `claude/jovial-knuth-c5b390` 合并到最新 `main` 并推送远端。
- Completed:
  - 先将本地 `main` 快进到 `origin/main` 最新 9 个提交。
  - 使用 `--no-ff --no-commit` 合并远端成长记录分支，解决 `docs/agent-benchmark-results.md`、`frontend/src/styles/mobile-app.css`、`harness/claude-progress.md` 三处冲突。
  - 样式冲突保留最新视觉刷新空态插画样式，并合入成长记录 MVP 表单/历史样式。
- Verification run:
  - `bash harness/init.sh`
  - `npm run verify:frontend`
  - `mvn -f backend/pom.xml test`
- Evidence:
  - Harness init passed with production frontend build and Agent benchmark.
  - Frontend verification passed across desktop and six mobile viewports.
  - Backend Maven suite passed with 222 tests, 0 failures, 1 skipped.
- Known risks:
  - 本次只做代码分支集成和本地验证，未部署 Aliyun，也未改生产数据。

### Session 2026-05-31 Growth Measurement MVP Simplification

- Goal: 按 review 建议把成长指标功能收敛成简单可交付的 MVP，并补齐性别、出生体重、出生身长的全链路 UI/状态/持久化验证。
- Completed:
  - 移除 premature 的成长曲线组件、内置 WS/T 423 参考表和未验证的数据抽取说明，避免用复杂参考曲线掩盖当前简单记录需求。
  - 保留并验证资料页中的性别、出生体重、出生身长字段，以及成长页中的身高/体重/头围手动记录、备注和历史列表。
  - 给成长记录输入增加上下限校验，并让后端共享状态按 `growthMeasurement.date` 排序。
  - 扩展前端 smoke：进入成长页、确认历史数据、拒绝 `999cm` 异常身高、记录 `68.2cm` 和备注，并断言页面不再渲染成长曲线。
  - 重新同步 Capacitor 资源，并确认 iOS/Android debug 客户端包都能构建。
- Verification run:
  - `bash harness/init.sh`
  - `npm run build && npm run smoke:frontend`
  - `npm run verify:frontend`
  - `mvn -f backend/pom.xml test`
  - `git diff --check`
  - `npm run mobile:sync`
  - `npm run build:ios:debug`
  - `npm run build:android:debug`
- Evidence:
  - Frontend verification passed across desktop and six mobile viewports.
  - Backend Maven suite passed with 204 tests, 0 failures.
  - Harness init passed with whitespace check, production frontend build, and Agent benchmark with 23 tests.
  - iOS debug build succeeded for iPhone 17 simulator.
  - Android debug APK built at `android/app/build/outputs/apk/debug/app-debug.apk`.
- Known risks:
  - 百分位、WHO/WS 参考曲线、早产校正、AI 解读和提醒仍是 future scope；本轮有意不把这些复杂逻辑塞进 MVP。

### Session 2026-05-26 Codex Placeholder Illustration Integration

- Goal: 接手 `docs/codex-todo-2026-05-26-placeholder-images.md`，为 Visual Refresh Phase 2 的 3 个占位点生成真实插画并替换前端 `Placeholder`。
- Completed:
  - 生成并落地 3 张暖色绘本风透明 PNG 插画：
    - `frontend/src/assets/illustrations/hero-records-today.png`（1024x576，记录页今日发现顶部 hero）
    - `frontend/src/assets/illustrations/empty-ledger.png`（320x240，账本明细空态）
    - `frontend/src/assets/illustrations/empty-reminders.png`（400x300，提醒全空态）
  - `DailySummaryView.tsx`、`LedgerView.tsx`、`App.tsx` 均由 `<Placeholder>` 替换为真实 `<img>` 资产引用；`Placeholder.tsx` 保留备用。
  - 补充图片样式：`daily-summary__hero` 固定 16:9、宽度 100%、object-fit contain；空态插画统一 block + contain；提醒空态插画保留最大宽度。
- Verification run:
  - `bash harness/init.sh`（开始前 baseline：`git diff --check`、`npm run build`、`npm run test:agent-benchmark` 通过）
  - `npm run build`
  - `npm run verify:frontend`
  - `node scripts/probe-daily-summary-view.mjs`
- Evidence:
  - `npm run verify:frontend` 通过 desktop + 6 mobile viewport。
  - `node scripts/probe-daily-summary-view.mjs` 生成 21 张截图；`iphone-13-390x844-1-records-today.png` 顶部显示真实 hero 插画，`iphone-13-390x844-7-reminders.png` 显示真实提醒空态插画。
- Known risks:
  - 账本明细空态插画已接入并通过 build/smoke，但现有专项 probe 没有自动切到账本明细空态截图；后续若改账本空态，可补一条专用视觉 probe。

### Session 2026-05-26 Visual Refresh Phase 2

- Goal: 给 4 个关键插画位置和 1 个加载状态加占位，让 codex 之后可以生成实际图片填充；DailySummaryView 生成 AI 时显示 shimmer skeleton 避免空白。详见 `docs/superpowers/specs/2026-05-26-visual-refresh-plan.md` §Phase 2。
- Completed:
  - 新增 `frontend/src/components/Placeholder.tsx`：友好暖色调占位框，data-placeholder + data-placeholder-spec 属性供 codex 检索，role=img + aria-label="..（占位图）"，支持 kind / aspect / width / height / caption / spec props。
  - 新增 `frontend/src/components/Skeleton.tsx`：宽高/圆角/inline 可配，shimmer 动画 1400ms 循环，prefers-reduced-motion 兜底。
  - 新增 `frontend/src/styles/placeholder.css`：占位虚线边 + 斜纹背景 + lucide ImageIcon 中心 hint + 暖色 caption；shimmer keyframe 用渐变 background-position 移动。
  - 插入 3 个占位（原 spec 4-5 个，但 records/album 空态已有 PNG storybook icon，跳过避免重复）：
    - `hero-records-today`（16:9 banner，DailySummaryView 顶部）
    - `empty-ledger`（160x120，LedgerView 明细空态替换 lucide ReceiptText 通用 icon）
    - `empty-reminders`（200x150，提醒 Tab 4 group 全空时新增显示）
  - DailySummaryView 加 `loading?: boolean` prop。loading=true && !summary → 显示 3 块 Skeleton 模拟 4 模块布局；loading=true && summary → 仍正常渲染不打断；loading=false && !summary → 维持原 null 行为。
  - App.tsx 把 `isGeneratingDailySummary` 传给 DailySummaryView 作为 loading；用户点"生成今日小结"时 shimmer 接替空白。
  - OTA `0.1.0-20260526131339` 上传 OSS（checksum `007a0a1b67dfb0f855e41227c3efcad90898c905a0579074180c795d93776c6e`），manifest 同步 ECS，云端 health=ok。
- Verification run:
  - `npm run build` 多次
  - `npm run verify:frontend` → 7 viewport PASS（hero placeholder + reminders empty placeholder + ledger empty placeholder 均不破坏 layout）
  - `node scripts/probe-daily-summary-view.mjs` → 12 截图确认 hero 出现在 DailySummaryView 顶部、reminders 空态 placeholder + 引导文案显示
  - OTA build → OSS 上传 → ECS manifest 同步 → cloud health 与 OTA check 验证
- Evidence:
  - Records-today 截图：顶部 16:9 暖色虚线框 + ImageIcon + "月龄相关温馨场景" caption，与下方 4 模块自然融合
  - Reminders 截图：4 group 全空时显示 200x150 placeholder + "还没有任何提醒。从上面点一个常用模板开始吧。"
  - Smoke 7 viewport 无 overflow；probe 12 截图无视觉异常
  - 云端 OTA check 返回 `version=0.1.0-20260526131339 message=视觉刷新 Phase 2 占位图+骨架屏`
- Known limitations:
  - **Shimmer skeleton 实际效果未截图验证**：probe fixture 始终有 dailySummary，触发不了 loading=true 路径。需真机点"生成今日小结"按钮观察 shimmer。
  - **Ledger empty placeholder 在明细 tab**：probe 拍的是默认本月 tab，明细 tab 空态 placeholder 未截图。结构正确（build pass）但未视觉验证。
- 待 codex 生成图片（按 data-placeholder kind 检索）：
  - `hero-records-today`：月龄相关温馨场景（如喂奶/哄睡/抓拍），16:9，暖色 pastel
  - `empty-ledger`：钱包或购物袋插画，160x120，暖色
  - `empty-reminders`：铃铛或月历插画，200x150，暖色

### Session 2026-05-26 Visual Refresh Phase 1

- Goal: 把全局视觉从"信息密集"快速变得"轻松活泼"，CSS-only + emoji + 全局动效，零业务改动，立即上线。详见 `docs/superpowers/specs/2026-05-26-visual-refresh-plan.md` §3。
- Completed:
  - DailySummaryView 6 类 finding label 加 emoji 前缀（🤝/🔗/💰/📈/📷/🧠）；4 个 section h3 加装饰 emoji（👶/✨/👀/📝）；facts 从「；」拼接改为 `<ul>` 每条一行。
  - 新建 `frontend/src/styles/motion.css`：`.fade-in` / `.fade-in-up` / `.stagger`（前 6 个子元素逐 40ms 延迟入场）/ `.tab-content-enter`；带 `prefers-reduced-motion` 兜底。
  - 新建 `frontend/src/styles/buttons-tap.css`：全局 `button:active` scale(0.97)；hover 暖色阴影；finding action 增强；带 reduced motion 兜底。
  - DailySummaryView 根 section 加 `stagger`，4 个 inner sections 加 `fade-in-up` —— 首次进入页面 6 个块依次入场。
  - LedgerView root section、App.tsx 6 个 tab section 加 `tab-content-enter`（首次进入动画，tab 切换不重触发因为 sections 始终挂载——已记 known limitation）。
  - 聊天 Tab 5 个 quick pill 加 emoji（🍼/🔔/⭐/💰/🤖），移除冗余 `<img className="quick-icon-img">`，避免 icon + emoji 双图标拥挤。
  - iPhone SE (375px) padding 修复：`@media (max-width: 380px)` 缩 quick-row gap 与 button padding，emoji pill 适配最窄机型。
  - OTA `0.1.0-20260526125222` 已上传 OSS（checksum `b20e600d5c56039ed3d31b6708f135e8ad60c82c160bb8f3d211d88abed0ac7f`），manifest 同步到 ECS，云端 health=ok。
- Verification run:
  - `npm run build`（多次，最终 711ms）
  - `npm run verify:frontend` → 7 viewport PASS（中间一次 iPhone SE pill 溢出被 padding 修复后再次 PASS）
  - `node scripts/probe-daily-summary-view.mjs` → 12 截图（3 viewport × 4 场景）确认 emoji + 入场动画 + tap 反馈视觉无回退
  - OTA build → OSS 上传（需 `JAVA_HOME=Android Studio JDK` + PATH 前置）→ ECS manifest 同步 → cloud health 与 OTA check 验证
- Evidence:
  - DailySummaryView 截图：4 模块均带 emoji 装饰、6 类 finding tag 前缀 emoji 可见、facts 分行渲染
  - 聊天 Tab 截图：5 个 pill 全部 emoji 化、风格统一
  - Smoke 7 viewport 无 overflow 报警；probe 12 截图无视觉异常
  - 云端 OTA check 返回 `version=0.1.0-20260526125222 message=视觉刷新 Phase 1`，签名 OSS URL 下发
- Known risks / limitations:
  - **Tab 切换动画失效**：6 个 tab section 是 always-mounted（CSS display 切换），`tab-content-enter` 只在首次进入页面时跑一次，tab 切换不重新触发。要修需 `key={activeMobileTab}` 强制 remount（会丢内部状态）或 useEffect+class toggle。本期接受 limitation。
  - 真机 reduced-motion 行为未验证（macOS 浏览器测试 prefers-reduced-motion 通常默认 no-preference）。
  - Phase 1 完全没动业务逻辑、后端、数据模型，回滚仅需 revert 几个 commit。
- Phase 2/3/4 留待：
  - Phase 2：5 个关键插画占位 + skeleton loading（codex 生成图片填充）
  - Phase 3：DailySummaryView「宝宝今天」升级为 stat cards + mini sparklines
  - Phase 4：月龄主题 / 节日彩蛋 / 暗色模式

### Session 2026-05-26 Cross-Domain Daily Summary AI

- Goal: 把现有 deterministic 每日小结升级为跨域 AI 信息发现型「今日发现」。仅本地落地代码与文档，不部署，云端部署留待手动决定。
- Completed:
  - 新增 `FindingDto` / `FindingRelated` / `FindingAction` 三个 DTO record，扩展 `DailySummaryDto` 加 `findings` 字段 + 向后兼容 compact constructor。
  - 新增 `DailySummaryPrompts`（system prompt + 6 类 finding type + JSON schema）、`DailySummaryAiClient` functional interface + `DefaultDailySummaryAiClient`（DeepSeek V4 Pro，30s timeout，markdown fence 剥离）。
  - 新增 `DailySummaryFindingValidator`：6 类 type 白名单、10 个禁词（应该/建议/异常 等）、id 存在性校验、action target 格式校验、文本 ≤60 字。7 个单测全部 TDD 覆盖。
  - `CareLogRecordService.getRecentDaysAggregate(familyId, days)` 滑动均值 + `ExpenseItemRecordService.getRecentSimilarExpenses(familyId, productName, months)` fuzzy match，均含 3 个 SpringBootTest 单测。
  - `DailySummaryService.buildSummary()` 串入 AI：稀疏数据 (<3 records) 跳过 AI 调用、JSON 解析失败兜底 deterministic、`sharedSummary()` 持久化 findings 到 family-shared payload。3 个 service-level 集成单测 (mock AI client + mock CurrentUser + mock ProTrialService)。
  - 验证阶段 Pro 围墙暂全员开放：`ProTrialService.isProEnabled` 永远返回 true、`requireProCaregiver` 改为 caregiver-only check；原逻辑保留为 `@SuppressWarnings("unused")` 私有方法。
  - Agent benchmark 加 2 case：信息发现型 6 类 finding 全通过验证器 + 模型异常时 fallback 到空 findings。
  - 前端 `types.ts` 加 `Finding/FindingRelated/FindingAction/FindingType`，`appStateDomain.ts` normalizer 补 findings 默认空数组。
  - 新建 `frontend/src/views/DailySummaryView.tsx`（4 模块 + 6 类 finding 渲染 + action 跳转）+ `frontend/src/utils/dailySummary.ts`（`parseActionTarget`, `FINDING_TYPE_LABEL/COLOR`）+ `frontend/src/styles/daily-summary.css`。
  - `App.tsx` 挂载 `<DailySummaryView />` 在「记录」Tab today 页顶部，`handleFindingActionClick` 处理 ledger/album/milestone/reminder 跳转（milestone 同时切到「我的」Tab，否则 view 不渲染）。「申请 Pro 内测」按钮以 `{false && (...)}` 隐藏。
  - smoke fixture 注入 3 类 sample findings；新建 `scripts/probe-daily-summary-view.mjs` 跨 3 viewport 拍 DailySummaryView + Pro 按钮隐藏 + action 跳转截图。
  - 落地 spec `docs/superpowers/specs/2026-05-26-cross-domain-daily-summary-design.md` + plan；该 plan 现已归档到 `docs/archive/completed-2026-06-05/2026-05-26-cross-domain-daily-summary.md`。
  - 共 20 个 session commits（含 2 个 Task 8 中途修复 + 1 个 milestone tab 跳转 bug 修复，由 probe 视觉验证抓到）。
- Verification run:
  - `bash harness/init.sh`
  - `mvn test`（IDEA bundled mvn + Android Studio JDK）
  - `npm run test:agent-benchmark`
  - `npm run verify:frontend`
  - `node scripts/probe-daily-summary-view.mjs`（DailySummaryView 跨视口截图 + action 点击流程）
- Evidence:
  - Backend `mvn test`: 222 tests，0 新失败（1 pre-existing `AppStateControllerTests.sharedRecordsReturnContributorAndHydrateExpenseAttachments` 不相关，1 skipped 是本次 Task 9 主动 `@Disabled` 的 Pro gating 测试）。
  - `npm run test:agent-benchmark`: PASS，25 tests（23 原有 + 2 新增）。
  - `npm run verify:frontend`: PASS，desktop + 6 mobile viewports。
  - Probe 截图 12 张（3 viewports × 4 场景），DailySummaryView 4 模块正确渲染、6 类 finding tag 颜色区分、`去账本` action 切到账本 Tab、`标记里程碑` action 切到「我的」Tab 并打开 MilestonesView、「我的」Tab 无 Pro 申请按钮。
- Known risks:
  - 未跑真模型 E2E：所有 backend AI 测试用 mock client；真 DeepSeek 输出质量需上线后用真家庭数据验证。
  - `familyMemberIds` / `familyMemoryIds` / `listFamilyMemory` 当前返回空集合，所以 `memory_recall` / 跨成员关联类 finding 会被 validator 拦截。后续可增强 finding 召回。
  - 缓存语义：`DailySummaryService.read()` 保持 read-only（cache miss 返回 null），只有显式 `generate()` 才调 AI 模型，避免每次刷新页面烧 token。
- Deploy:
  - OTA `0.1.0-20260526122526` 已上传 OSS（checksum `0d7a1c5778448445e6e29d1c2d5b6090aaf501867d98e60435a83db2ef3c0682`），manifest 已同步到 ECS，云端 `/api/health` 返回 `ok`。
  - 部署命令：`SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`，本地 mvn 需 `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home` + IDEA bundled mvn。
  - 真实家庭数据 + DeepSeek 模型质量需用户手动触发"生成今日小结"后观察。
### Session 2026-05-16 Voice Hold Pointer Drift Fix

- Goal: 修复语音按钮按住后手指稍微移动就断开的问题，让移动端按住说话只在松手、取消或页面失焦时结束。
- Completed:
  - 移除语音按住按钮的 `pointerleave` 停止录音逻辑，避免手指自然滑出按钮边界时提前断开。
  - 增加按压会话追踪，并用 window 级 `pointerup` / `pointercancel` / `blur` 兜底收尾；即使 WebView 拒绝 `setPointerCapture`，也能保持按住状态稳定。
  - 重新同步 iOS/Android web 资源，并确认 iOS debug build 通过，方便继续打 iOS 包。
  - 发布 OTA `0.1.0-20260516223427`，消息 `修复语音按住移动中断`，并部署到 Aliyun。
- Verification run:
  - `bash harness/init.sh`
  - `npm run build`
  - `npm run verify:frontend`
  - Local Playwright pointer-drift probe for voice hold.
  - `npm run mobile:sync`
  - `npm run build:ios:debug`
  - `MOBILE_UPDATE_MESSAGE='修复语音按住移动中断' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, signed OSS checksum probe, and up-to-date probe.
- Evidence:
  - Frontend verification passed across desktop and six mobile viewports.
  - Local pointer-drift probe stayed in `connecting` after `pointerleave`, then returned to `idle` after `pointerup`.
  - `npm run mobile:sync` passed and copied the updated web assets into iOS/Android projects.
  - `npm run build:ios:debug` succeeded for iPhone 17 simulator.
  - Cloud health returned `ok`.
  - OTA check returns version `0.1.0-20260516223427`; downloaded bundle size was `2641156` bytes and SHA-256 matched manifest checksum `c2bb9c56a60b404f2a8ed967996697c2b02fe2da52cb0ee08f70a34e4c9f6592`.
  - Up-to-date probe using `currentBundleVersion=0.1.0-20260516223427` returned `updateAvailable=false`.
- Known risks:
  - The automated pointer probe mocks browser media/ASR and validates the frontend gesture lifecycle. Real iOS microphone permission state still needs normal device-level validation during packaging or TestFlight install.

### Session 2026-05-16 Chat Attachment Tray Layout

- Goal: 修复聊天输入区多图附件上传时过度拥挤的问题，让 8 张图片场景下附件清单可收起/展开，并顺手优化删除叉叉按钮的样式和对齐。
- Completed:
  - 将 composer 顶部的横向硬挤附件条改成附件摘要层：超过 2 个素材且无上传中任务时默认收起，只展示数量、类型摘要、上限状态和少量缩略预览。
  - 展开后显示固定高度的 2 列附件清单，超过高度内部滚动，不再把模型选择、工具按钮和输入框挤乱。
  - 删除按钮改为 28px 圆形轻按钮，和 30px 缩略图垂直对齐，避免默认方块按钮破坏视觉。
  - 上传中的素材仍保持展开，让用户能看到进度；上传完成后可自动进入可收起状态。
  - 发布 OTA `0.1.0-20260516220400`，消息 `优化多图附件上传层样式`，并部署到 Aliyun。
- Verification run:
  - `bash harness/init.sh`
  - `npm run build`
  - `npm run verify:frontend`
  - Playwright local 8-image attachment tray probe with collapsed and expanded screenshots under `.verification/frontend-smoke/`.
  - `git diff --check`
  - `MOBILE_UPDATE_MESSAGE='优化多图附件上传层样式' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, signed OSS checksum probe, and up-to-date probe.
- Evidence:
  - Frontend verification passed across desktop and six mobile viewports.
  - Local 8-image tray probe on 390x844 reported collapsed height 181px, expanded list height 134px, 8 rendered items, and no horizontal overflow.
  - Cloud health returned `ok`.
  - OTA check returns version `0.1.0-20260516220400`; downloaded bundle size was `2640958` bytes and SHA-256 matched manifest checksum `7b504315d9aa9db266035dcd6636d4509120be6b0e990baccd49253502e340f6`.
  - Up-to-date probe using `currentBundleVersion=0.1.0-20260516220400` returned `updateAvailable=false`.
- Known risks:
  - This is a web/OTA layout change only; no native build was run because no Capacitor/native files changed.

### Session 2026-05-16 Agent Skill Runtime Contract And Previous Image Retry

- Goal: 回应“不要靠前端正则判断刚才图片”的架构要求，把 Agent 能力统一到“模型选择 skill、后端 runtime 执行 skill 并做结构化兜底”的策略，并修复上一轮支出图片重试路径。
- Completed:
  - 新增 OpenSpec change `standardize-agent-skill-runtime-contract`，沉淀 Agent skill runtime contract、上一轮媒体引用、支出识别路径和开发验证要求。
  - `AgentPlanner` 支持输出 `skillRequests`，并在 prompt 中要求上一轮/当前支出图片记录请求选择 `expense-recognition` execute。
  - `SkillRouter` 优先执行 planner 选择的 allowlisted executable skill，保留后端 deterministic fallback 作为安全兜底。
  - 前端删除“刚才/上面/之前...花费...再记录”正则转发上一轮附件逻辑；前端只提交当前附件和 recentMessages 附件元数据。
  - `AgentRuntime` 在 `expense-recognition` 被选中且当前请求无图片字节时，按 familyId 从后端附件存储加载最近消息中的视觉附件再执行 skill。
  - `AttachmentStorageService` 增加按附件 id + familyId 读取 dataUrl 的 runtime 入口，避免跨家庭读取。
  - 支出识别分类变成非阻断字段：`月子鞋/月子服` 推断为 `clothing`，`摇奶器/恒温壶/暖奶器/奶瓶/洗衣机` 等推断为 `daily`，不确定用 `other`。
  - skill 未产出完整候选时，runtime 生成 skill-sourced clarification，防止最终模型绕过 skill 平行制造账本候选。
  - 更新 `docs/agent-detailed-design.md` 说明 planner -> skill runtime -> effect/persistence 的统一策略。
  - 发布 OTA `0.1.0-20260516203136`，消息 `统一Agent Skill Runtime并修复支出重试`，并部署后端到 Aliyun。
- Verification run:
  - `bash harness/init.sh`
  - `mvn -f backend/pom.xml -Dtest=AgentPlannerTests,SkillRouterTests,AgentRuntimeTests,ExpenseRecognitionSkillTests,AgentBenchmarkTests test`
  - `openspec validate standardize-agent-skill-runtime-contract --strict`
  - `npm run test:agent-benchmark`
  - `npm run build`
  - `npm run verify:frontend`
  - `mvn -f backend/pom.xml test`
  - `MOBILE_UPDATE_MESSAGE='统一Agent Skill Runtime并修复支出重试' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, signed OSS checksum probe, and up-to-date probe.
- Evidence:
  - Targeted backend tests passed: 60 tests, 0 failures.
  - Full backend tests passed: 179 tests, 0 failures.
  - Agent benchmark passed: 23 tests, 0 failures, including previous-image retry without frontend attachment forwarding and category-only non-blocking coverage.
  - Frontend smoke passed across desktop and six mobile viewports.
  - OpenSpec change `standardize-agent-skill-runtime-contract` is valid and all tasks are complete.
  - Cloud health returned `ok`.
  - Cloud OTA check returns version `0.1.0-20260516203136`; downloaded bundle size was `2640023` bytes and SHA-256 matched manifest checksum `6a2ca6559f1441ad8444de3e084b2fe0c802abb97a289fa4d2a559644862bcfc`.
  - Up-to-date probe using `currentBundleVersion=0.1.0-20260516203136` returned `updateAvailable=false`.
- Known risks:
  - Planner model selection is still probabilistic. Backend fallback covers common previous-image retry wording when recent visual metadata exists, but exotic references may still need future benchmark expansion.
  - Real recognition quality still depends on whether the referenced screenshots remain accessible and contain readable actual payment evidence.

### Session 2026-05-16 Cloud AI Temporary Unavailable Root Cause Fix

- Goal: 排查云端为什么在 137****2890 多图支出识别后提示“AI服务暂时不可用”，并修复真实线上故障点。
- Completed:
  - 查云端日志确认 2026-05-16 19:52:16 的失败不是模型厂商、API Key、额度或上传问题；上传链路和 `/api/health` 都正常。
  - 根因定位为新加的支出自动入账持久化在 `agent-stream-*` 异步线程里调用 `CurrentUser.requirePrincipal()`，线程内没有请求登录上下文，抛出 `AUTH_REQUIRED`，随后被前端展示成通用“AI服务暂时不可用”。
  - 为 `AppStateService.persistAgentExpenseCandidates` 增加显式 `familyId/userId` 入口。
  - 修改 Agent 同步与流式路径，在已知 `AuthPrincipal` 的位置把 `familyId/userId` 传入支出识别持久化，避免异步线程再依赖 thread-local 登录上下文。
  - 增加 `AgentRuntimeTests.expenseRecognitionPersistenceUsesExplicitPrincipalForAsyncStreams`，保护该异步保存回归。
  - 已用 `SYNC_DATA=0` 后端-only 方式部署到 Aliyun；未发布 OTA，因为前端 bundle 没变。
- Verification run:
  - `bash harness/init.sh`
  - `mvn -f backend/pom.xml -Dtest=AgentRuntimeTests,AppStateControllerTests,AgentBenchmarkTests test`
  - `npm run test:agent-benchmark`
  - `SYNC_DATA=0 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`
  - Cloud journal probe for `AUTH_REQUIRED` / `Agent stream failed before model stream`
- Evidence:
  - Harness smoke passed before the fix: `git diff --check`, `npm run build`, and `npm run test:agent-benchmark`.
  - Targeted backend tests passed: 65 tests, 0 failures.
  - Agent benchmark passed: 21 tests, 0 failures.
  - Cloud health returned `ok` after deploy.
  - Cloud log shows the original failure at `2026-05-16T19:52:16+08:00`: `Agent stream failed before model stream ... cause=AUTH_REQUIRED`.
  - Cloud log shows new backend started at `2026-05-16T19:57:44+08:00`; no `AUTH_REQUIRED` / `Agent stream failed before model stream` entries appeared after that timestamp in the verification window.
- Known risks:
  - This fix removes the confirmed async-auth failure. A live user retry is still the best end-to-end proof for the exact 8-image conversation path because the real model call depends on current provider response and image legibility.

### Session 2026-05-16 Expense Agent Auto Save Interaction Contract

- Goal: Implement the grilled interaction contract for expense recognition: complete recognized expenses should be saved directly when the user asks to record them, duplicate confirms must be idempotent, category uncertainty must not block recording, and final AI copy must reflect actual saved/duplicate/needs-input state instead of asking again.
- Completed:
  - Added an OpenSpec change at `openspec/changes/improve-expense-agent-recording-flow` covering the new expense Agent recording contract.
  - Added `ExpensePersistenceResult` and backend persistence flow for saved, duplicate, needs-input, and read-only recognized expense candidates.
  - Auto-save complete expense-recognition candidates when the user has clear recording intent; preserve recognition-only requests as read-only.
  - Added stable expense dedupe keys from date, amount, normalized title/merchant, and attachment ids; pending-effect confirmation now uses the same dedupe path so two confirm cards or double confirms cannot insert duplicate expense rows.
  - Extended expense category inference for `月子鞋/月子服` and feeding appliance terms such as `摇奶器/恒温壶/奶瓶/消毒器/温奶器`, with `other` fallback instead of category confirmation.
  - Fed persistence facts into final Agent composition/postprocessing so saved rows show as saved, duplicates are summarized, and stale “确认金额后再记账” copy is replaced.
  - Added a deterministic fallback response when expense persistence already happened but the final model reply fails, so the user still sees saved/duplicate/needs-input facts instead of a generic AI failure.
  - Updated frontend chat handling so auto-saved expenses refresh local ledger state without creating a pending confirmation card, and confirmation buttons enter a `保存中` disabled state to prevent repeated taps.
  - Left existing production duplicate rows untouched per user direction; users can delete unwanted duplicates manually from ledger details.
  - Published backend code plus OTA `0.1.0-20260516194139` with message `优化支出识别自动入账`.
- Verification run:
  - `mvn -f backend/pom.xml -Dtest=AgentBenchmarkTests,AgentRuntimeTests,EffectPolicyTests,AppStateControllerTests,ExpenseRecognitionSkillTests test`
  - `npm run test:agent-benchmark`
  - `npm run build`
  - `npm run verify:frontend`
  - `openspec status --change improve-expense-agent-recording-flow`
  - `openspec validate improve-expense-agent-recording-flow --strict`
  - `MOBILE_UPDATE_MESSAGE='优化支出识别自动入账' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - `SYNC_DATA=0 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, OSS signed URL download checksum probe, and up-to-date probe.
- Evidence:
  - Targeted backend tests passed: 95 tests, 0 failures.
  - Agent benchmark passed: 21 tests, 0 failures, including `benchmarkSavedExpenseRecognitionDoesNotBecomeConfirmAgainAsk`.
  - Frontend smoke passed across desktop and six mobile viewports.
  - OpenSpec change `improve-expense-agent-recording-flow` is valid and has all artifacts complete.
  - Cloud health returned `ok`.
  - Cloud OTA check returns version `0.1.0-20260516194139`; downloaded bundle size was `2640408` bytes and SHA-256 matched manifest checksum `2999bfa53dc6806f5262b9fcadd39aefeb4406e6055c876552d0b75bb16c08d2`.
  - Up-to-date probe using `currentBundleVersion=0.1.0-20260516194139` returned `updateAvailable=false`.
  - Backend-only redeploy after fallback handling returned cloud health `ok`; OTA up-to-date probe still returned `updateAvailable=false`.
- Known risks:
  - Existing production duplicate expense rows were intentionally not cleaned up.

### Session 2026-05-16 Expense Ledger Id Collision Fix

- Goal: Investigate user `137****2890`'s latest Agent expense recording flow, explain why the prior hospitalization expense was overwritten, and ship guards against repeat ledger overwrites.
- Completed:
  - Inspected production chat, Agent trace, skill trace, pending-effect confirmation requests, and expense rows for family `family-eb3f4751-****`.
  - Confirmed the 2026-05-16 17:20 expense image run produced 4 complete expense-recognition candidates, but the final composer also returned the same 4 model expenses, creating 8 pending expense items.
  - Confirmed the previous hospitalization expense was recoverable from 2026-05-12 chat payloads as `芊宝出生住院生产花费` amount `8887.24`, but it is no longer present in `expense_item` because pending expense payloads with fallback ids like `expense-0` were confirmed with `saveOrUpdate`.
  - Fixed frontend expense normalization to generate durable unique ids instead of `expense-${index}` for AI pending expense payloads.
  - Fixed backend pending-effect confirmation to regenerate old fallback ids like `expense-0` and to canonicalize payload `id` to the actual persisted record id.
  - Fixed `EffectPolicy` so executable `expense-recognition` candidates suppress duplicate model expense candidates.
  - Fixed Agent reply postprocessing so an amount question is not appended when the model text already asks for the actual amount.
  - Published backend code plus OTA `0.1.0-20260516173716` with message `修复账本覆盖和重复支出`.
  - After explicit user approval to repair production data, restored the overwritten 2026-04-19 hospitalization expense to `expense_item` as `expense-restored-hospital-mp2lqef1`, preserving the original note and image attachment reference `attachment-mp2lomag-chc0xt`.
- Verification run:
  - `mvn -Dtest=AgentRuntimeTests,EffectPolicyTests,AppStateControllerTests test`
  - `mvn test`
  - `npm run test:agent-benchmark`
  - `npm run verify:frontend`
  - `git diff --check`
  - `MOBILE_UPDATE_MESSAGE='修复账本覆盖和重复支出' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, OSS signed URL download checksum probe, and up-to-date probe.
- Evidence:
  - Targeted backend tests passed: 65 tests, 0 failures.
  - Full backend tests passed: 164 tests, 0 failures.
  - Agent benchmark passed: 20 tests, 0 failures.
  - Frontend smoke passed across desktop and six mobile viewports.
  - Cloud health returned `ok`.
  - Cloud OTA check returns version `0.1.0-20260516173716`; downloaded bundle size was `2640325` bytes and SHA-256 matched manifest checksum `c8440860c0dc6a45c20b61737a647efd77a89a6e21d3fca3ad941adcfa4ad329`.
  - Production DB backup was created at `/var/lib/ai-baby-growth-companion/baby-companion.sqlite.before-hospital-restore-20260516094541` before restoring the hospitalization expense.
  - Production `expense_item` now contains `expense-restored-hospital-mp2lqef1` with title `芊宝出生住院生产花费`, amount `8887.24`, date `2026-04-19`, note `总消费额34189.43元，医保报销25302.19元，自费合计8887.24元，其中包含伙食费405元、温馨陪伴费1680元`, and `attachmentIds[0]=attachment-mp2lomag-chc0xt`.
  - Production `attachment` still contains `attachment-mp2lomag-chc0xt` with image metadata, `/api/uploads/attachment-mp2lomag-chc0xt`, and thumbnail path `/api/uploads/attachment-mp2lomag-chc0xt/thumbnail`.
- Known risks:
  - The 2026-05-16 duplicate four expense rows created by the same bug were not deleted in this session; deleting duplicates is a destructive data change and should be done only with explicit user confirmation.

### Session 2026-05-16 Executable Expense Recognition Skill Worker

- Goal: Implement OpenSpec change `add-expense-recognition-skill-worker` so expense screenshot recognition becomes an executable, traceable skill instead of scattered prompt/runtime/postprocess behavior.
- Completed:
  - Added `agent_run` and `skill_run` SQLite tables, MyBatis entities/mappers/services, and `AgentTraceService` with trace payload scrubbing so image `dataUrl`, video bytes, and base64 payloads are not persisted.
  - Added explicit skill modes (`execute`, `disclose`, `guard`), `SkillPlan`, `SkillRouter`, and routing for current expense images plus forwarded previous-image retry attachments.
  - Added model profile configuration for planner, final composer, and expense recognition; expense recognition has independent model, max tokens, temperature, batch size, and retry fields.
  - Added `ExpenseRecognitionSkill` as the first executable skill worker. It runs no-tools, low-temperature visual extraction, batches multi-image requests, forbids web/reference-price lookup, returns structured pending `expenseItem` candidates only when required fields are present, and returns stage-specific Chinese failure/clarification copy otherwise.
  - Integrated the skill into `AgentRuntime` before final composition, injected skill results into the final composer context, kept non-expense visual analysis on the old path, preserved public Agent API compatibility, and recorded agent/skill traces.
  - Updated `EffectPolicy` so complete expense skill candidates are first-class candidates and are not overridden by text-only rule asks; final copy still suppresses redundant “实际花了多少钱” questions when a pending expense already has amount.
  - Deployed backend-only update to Aliyun with `SYNC_DATA=0`; no OTA was published because no frontend bundle assets changed.
- Verification run:
  - `bash harness/init.sh`
  - `mvn -DskipTests compile`
  - `mvn -Dtest=SkillRouterTests,ExpenseRecognitionSkillTests,AgentTraceServiceTests,AgentRuntimeTests,EffectPolicyTests,AgentBenchmarkTests test`
  - `mvn test`
  - `npm run test:agent-benchmark`
  - `npm run verify:frontend`
  - `openspec validate add-expense-recognition-skill-worker`
  - `git diff --check`
  - `SYNC_DATA=0 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`
  - Production SQLite table probe for `agent_run` / `skill_run`
- Evidence:
  - Targeted backend tests passed: 69 tests, 0 failures.
  - Full backend tests passed: 161 tests, 0 failures.
  - Agent benchmark passed: 20 tests, 0 failures, with new coverage for one-image expense skill draft, 8-image batching without web search, previous-image retry routing, and no redundant amount ask.
  - Frontend smoke passed across desktop and six mobile viewports.
  - OpenSpec validation passed for `add-expense-recognition-skill-worker`.
  - Cloud health returned `ok`.
  - Production DB `/var/lib/ai-baby-growth-companion/baby-companion.sqlite` contains `agent_run` and `skill_run`.
- Known risks:
  - Real recognition quality still depends on image legibility and model output; the skill now returns stage-specific failure or clarification instead of pretending an unreadable image is a normal missing-amount text request.
  - The first implementation executes expense image batches sequentially. This is simpler and safer for provider load, but a later latency pass can evaluate bounded parallelism.

### Session 2026-05-16 Previous Expense Retry And Postprocess Copy

- Goal: Fix user `137****2890`'s follow-up request to "record the above expenses again" and stop rule postprocessing from wiping out useful model text.
- Completed:
  - Confirmed production data showed the latest parent message had no new attachments and the AI reply was generated by a rule `ask` decision for a missing expense amount.
  - Added frontend retry forwarding: when the user references prior expense images (`刚才/上面/之前...花费...再记录`), the chat request reuses the most recent visual attachments for Agent analysis without showing duplicate attachments on the new message.
  - Adjusted expense effect policy so previous-expense retry wording does not become a brand-new missing-amount ask before the model can use prior images or context.
  - Changed Agent text postprocessing to preserve model text and append clarification questions when needed, instead of replacing the whole reply; existing boundary copy is also preserved when the model already explains the limitation.
  - Updated the Agent prompt to treat previous-expense retry wording as a contextual retry, not a new incomplete expense.
  - Published backend code plus OTA `0.1.0-20260516152314`.
- Verification run:
  - `mvn -q -Dtest=AgentRuntimeTests test`
  - `npm run test:agent-benchmark`
  - `npm run verify:frontend`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, and OSS signed URL download checksum probe.
  - `bash harness/init.sh`
- Evidence:
  - `AgentRuntimeTests` now covers preserving model text when a rule clarification is added and deferring rule amount asks for previous expense image retries.
  - Agent benchmark passed and refreshed `docs/agent-benchmark-results.md`.
  - Frontend smoke passed across desktop and six mobile viewports.
  - Cloud health returned `ok`.
  - Cloud OTA check returns version `0.1.0-20260516152314` with signed OSS URL for `/baby-companion/mobile-updates/app-0.1.0-20260516152314.zip`.
  - Downloaded bundle size was `2640317` bytes and SHA-256 matched manifest checksum `455a69da31438dc9f37aa6866ab7e8574d668b7b4540ee6e061ef15c41502d44`.
  - Final harness init passed after the release.
- Known risks:
  - A retry can only succeed when the referenced prior attachments remain accessible and the images contain readable real payment information; otherwise the Agent should now explain the missing evidence instead of pretending it is a new expense with no amount.

### Session 2026-05-16 Batched Multi Image Agent Analysis

- Goal: Replace the previous timeout-only mitigation with real automatic multi-image batching for AI visual analysis.
- Completed:
  - Added backend automatic visual batching: when a request has more than 4 visual inputs, the Agent runs separate non-stream model OCR/visual-summary calls in batches of up to 4, then feeds those summaries into the final response request without re-attaching all images.
  - Added per-batch SSE progress text such as `正在分批分析 8 张图片`, `正在分析第 1/2 批图片`, and `正在整理图片分析结果`.
  - Preserved the 4-or-fewer path as a single visual request to avoid making small requests slower.
  - Added usage tracking label support for `agent_visual_analysis`.
  - Updated timeout copy to say the Agent already attempted batching before asking the user to reduce or split images.
  - Published backend code plus OTA `0.1.0-20260516145942` with message `多图AI自动分批分析`.
- Verification run:
  - `bash harness/init.sh`
  - `npm run build`
  - `mvn -Dtest=AgentRuntimeTests test`
  - `mvn test -q`
  - `npm run verify:frontend`
  - `npm run test:agent-benchmark`
  - `MOBILE_UPDATE_MESSAGE='多图AI自动分批分析' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, OSS signed URL download, checksum probe, and up-to-date probe.
- Evidence:
  - `AgentRuntimeTests` now covers splitting 8 visual inputs into 2 batches of 4, while keeping 4 visual inputs unbatched.
  - Backend full Maven tests passed.
  - Frontend smoke passed across desktop and six mobile viewports.
  - Agent benchmark passed and kept the expense-image no-web-search case green.
  - Cloud health returned `ok`.
  - Cloud OTA check returns version `0.1.0-20260516145942`, signed OSS host `ai-baby-growth-companion.oss-cn-hangzhou.aliyuncs.com`, and object path `/baby-companion/mobile-updates/app-0.1.0-20260516145942.zip`.
  - Downloaded bundle size was `2639905` bytes and SHA-256 matched manifest checksum `9f4e5454bd1d9c5e842a69e8981f975b5e757a7d5b339a0678b36a45815d9a98`.
  - Up-to-date probe using `currentBundleVersion=0.1.0-20260516145942` returned `updateAvailable=false`.
- Known risks:
  - Batched visual analysis is sequential in this release to avoid overloading provider concurrency; it improves reliability and transparency, but the next performance pass can evaluate limited parallelism if latency remains high.

### Session 2026-05-16 Multi Image Agent Availability

- Goal: Investigate user `137****2890`'s latest 8-image expense recognition failure and remove misleading in-chat status copy while improving AI vision availability.
- Completed:
  - Checked production logs for `137****2890` and confirmed the 8 image uploads completed successfully; the failure was a Doubao model stream timeout while analyzing image input, not upload failure.
  - Confirmed the UI stayed on `查找相关记录` because no later SSE status was emitted before the long model stream call.
  - Added backend model-work status events so clients see `正在分析 N 张图片` / `正在生成回复`; kept a compatible `retrieving_context` update so older clients still see truthful text.
  - Added frontend stream status handling for `analyzing_media` and `generating`, with chips `分析中` / `生成中`.
  - Added frontend image downscaling for the AI vision copy before sending attachments to the model, while preserving the original uploaded attachments in storage.
  - Raised Doubao read timeout default from `60s` to `120s` and replaced raw timeout errors with actionable image-analysis timeout copy.
  - Published backend code plus OTA `0.1.0-20260516144004` with message `优化多图AI分析提示和可用性`.
- Verification run:
  - `bash harness/init.sh`
  - `npm run build`
  - `mvn -Dtest=AgentRuntimeTests test`
  - `mvn test -q`
  - `npm run verify:frontend`
  - `npm run test:agent-benchmark`
  - `MOBILE_UPDATE_MESSAGE='优化多图AI分析提示和可用性' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, OSS signed URL download, checksum probe, and up-to-date probe.
- Evidence:
  - Production log chain showed 8 upload presign/complete pairs succeeded, then `Agent model stream failed ... provider=DOUBAO ... cause=request timed out`.
  - Backend full Maven tests passed.
  - Frontend smoke passed across desktop and six mobile viewports.
  - Agent benchmark passed and kept the expense-image no-web-search case green.
  - Cloud health returned `ok`.
  - Cloud OTA check returns version `0.1.0-20260516144004`, signed OSS host `ai-baby-growth-companion.oss-cn-hangzhou.aliyuncs.com`, and object path `/baby-companion/mobile-updates/app-0.1.0-20260516144004.zip`.
  - Downloaded bundle size was `2639867` bytes and SHA-256 matched manifest checksum `c677fb3cd5fcc5eac4eeae5492f15113670b528335cad9dc06cb0618c0b433bf`.
  - Up-to-date probe using `currentBundleVersion=0.1.0-20260516144004` returned `updateAvailable=false`.
- Known risks:
  - Real 8-image OCR quality still depends on the model and image legibility; the fix reduces payload size and timeout risk but does not guarantee every low-quality receipt or screenshot can be read.

### Session 2026-05-16 Expense Fix Cloud And OTA Release

- Goal: Review the cross-session OTA upload/download path changes, then commit, push, and release the current backend plus a fresh OTA bundle.
- Completed:
  - Checked the OTA path chain: `build-mobile-update.sh` writes the local bundle/manifest, `upload-mobile-update-oss.sh` uploads the zip to OSS and rewrites manifest with `ossObjectKey`, `deploy-aliyun-ecs.sh` can sync only `manifest.json`, and `MobileUpdateService` signs a fresh OSS URL from `ossObjectKey`.
  - Confirmed the current cloud service has `APP_STORAGE_MODE=oss`, OSS endpoint/bucket/prefix configured, and the existing production manifest already uses `baby-companion/mobile-updates/...`.
  - Built fresh OTA version `0.1.0-20260516140358` with message `修复多图记账并优化OTA下载`.
  - Uploaded `app-0.1.0-20260516140358.zip` to OSS under `baby-companion/mobile-updates/` and deployed backend code plus manifest-only OTA metadata to Aliyun `120.55.188.242:8300` without syncing production data.
- Verification run:
  - `bash harness/init.sh`
  - `mvn test -q`
  - `npm run verify:frontend`
  - `MOBILE_UPDATE_MESSAGE='修复多图记账并优化OTA下载' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun scripts/upload-mobile-update-oss.sh`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, OSS signed URL download, checksum probe, and up-to-date probe.
- Evidence:
  - Backend full Maven tests passed.
  - Frontend smoke passed across desktop and six mobile viewports.
  - Cloud health returned `ok`.
  - Cloud OTA check returns version `0.1.0-20260516140358`, signed OSS host `ai-baby-growth-companion.oss-cn-hangzhou.aliyuncs.com`, and object path `/baby-companion/mobile-updates/app-0.1.0-20260516140358.zip`.
  - Downloaded bundle size was `2638963` bytes and SHA-256 matched manifest checksum `4a98ea216826e56cdde2115d8a721b9a6fb8b7a9463d73ed319fbaf9b093dde2`.
  - Up-to-date probe for current bundle `0.1.0-20260516140358` returned `updateAvailable=false`.
- Known risks:
  - The OTA URL is a signed temporary OSS URL; clients should download soon after each check, and later checks will receive a fresh URL.

### Session 2026-05-16 OTA Bundle OSS Download Optimization

- Goal: Fix slow OTA bundle downloads by reducing mobile OTA bundle size and serving bundles from OSS instead of ECS public bandwidth.
- Completed:
  - Added a mobile-only frontend entry (`frontend/src/main.mobile.tsx`) and Vite mobile entry transform so `build:mobile:update` excludes website-only `/official` code and large landing assets.
  - Updated `scripts/build-mobile-update.sh` to set `VITE_BUILD_TARGET=mobile` and support explicit external bundle URL/base configuration.
  - Added `scripts/upload-mobile-update-oss.sh` to upload the generated OTA zip to Aliyun OSS using the existing OSS SDK dependency and rewrite the manifest with an `ossObjectKey`.
  - Updated `MobileUpdateService` so manifests with an OSS object key return a fresh signed OSS download URL during `/api/mobile-updates/check`.
  - Updated deployment flow with `SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1` for OSS-hosted OTA bundles.
  - Built and published OTA `0.1.0-20260516134621` with message `优化OTA下载速度`.
  - Uploaded `app-0.1.0-20260516134621.zip` to OSS under `baby-companion/mobile-updates/` and synced only the manifest to Aliyun ECS.
- Verification run:
  - `MOBILE_UPDATE_MESSAGE='优化OTA下载速度' MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `MOBILE_UPDATE_OSS_SSH_TARGET=ai-baby-aliyun scripts/upload-mobile-update-oss.sh`
  - `mvn -Dtest=MobileUpdateControllerTests test`
  - `npm run verify:frontend`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SYNC_MOBILE_UPDATE_MANIFEST_ONLY=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, OTA check, OSS bundle download, checksum probe, and up-to-date probe
  - `mvn test`
  - `git diff --check`
- Evidence:
  - Mobile OTA zip reduced from `6088639` bytes to `2638968` bytes; the mobile bundle no longer includes `hero-companion` or `splash-mark`.
  - Cloud OTA check returns version `0.1.0-20260516134621` with a signed OSS URL.
  - OSS download probe returned `200`, downloaded `2638968` bytes in `0.291882s`, and SHA-256 matched manifest checksum `e8c4b04e614e4ac25b93ea4a8546de7cb96b5af3b161e026697be0097c883a4a`.
  - Previous ECS bundle path for `6088639` bytes took `48.134758s` locally; server-local `127.0.0.1` was fast, confirming the old bottleneck was ECS public bandwidth plus bundle size.
  - Backend full Maven test passed: 141 tests, 0 failures.
  - Frontend smoke passed across desktop plus iPhone SE, iPhone 13, iPhone Pro Max, Android compact, Android Pixel, and Android large viewports.
  - Cloud up-to-date check for current bundle `0.1.0-20260516134621` returned `updateAvailable=false`.
- Known risks:
  - OSS signed URLs currently use the existing OSS signed URL TTL, so clients should start the download soon after each OTA check; future checks receive a fresh URL.
  - One large in-app image (`alarm-scene`, about 1.6MB) remains in the mobile bundle and can be compressed in a later asset pass.

### Session 2026-05-16 Pro AI Usage Display

- Goal: Let users see family AI token usage in the app and expose a family-scoped usage API.
- Completed:
  - Added `GET /api/pro/usage` to return current-family AI usage for a requested day window.
  - Added family-scoped usage aggregation by total, feature, and model using existing `ai_usage_log` records.
  - Added the Pro profile card AI usage panel with recent token total, call count, input/output split, top feature chips, model note, and refresh action.
  - Added frontend smoke mock data for `/api/pro/usage`.
  - Deployed the backend code-only update to Aliyun and published OTA `0.1.0-20260516125242`.
- Verification run:
  - `bash harness/init.sh`
  - `mvn -Dtest=ProTrialControllerTests test`
  - `mvn test`
  - `npm run build`
  - `npm run verify:frontend`
  - `git diff --check`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `/api/health`, unauthenticated `/api/pro/usage`, OTA check, and OTA bundle HEAD probes
- Evidence:
  - Backend full Maven test passed: 135 tests, 0 failures.
  - Frontend smoke passed across desktop plus iPhone SE, iPhone 13, iPhone Pro Max, Android compact, Android Pixel, and Android large viewports.
  - Cloud health returned `ok`.
  - Cloud unauthenticated `/api/pro/usage` returned `401`, confirming the route is present and protected.
  - OTA check returns version `0.1.0-20260516125242` with message `新增 AI 用量统计`.
  - Bundle `app-0.1.0-20260516125242.zip` returned HTTP 200 with `Content-Length: 6088639`.
- Known risks:
  - Some streaming provider calls still do not return token usage, so the panel separately notes unmetered stream calls when they exist.
  - Live authenticated `/api/pro/usage` was covered by backend tests, but not probed against a production user token in this session.

### Session 2026-05-16 Reminder Icon Polish

- Goal: Make reminder task icons clearer and less visually harsh on the reminders page.
- Completed:
  - Changed reminder list icons from strong filled color blocks to soft outlined badges in the warm theme.
  - Increased reminder card icon size slightly for better legibility.
- Verification run:
  - `npm run verify:frontend`
  - `git diff --check`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 MOBILE_UPDATE_MESSAGE='优化提醒待办图标显示' npm run build:mobile:update`
  - Manual `rsync` of `backend/data/mobile-updates/` to `/var/lib/ai-baby-growth-companion/mobile-updates/`
  - Cloud OTA check and bundle HEAD request
- Evidence:
  - Frontend build passed.
  - Frontend smoke passed across desktop plus iPhone SE, iPhone 13, iPhone Pro Max, Android compact, Android Pixel, and Android large viewports.
  - OTA version `0.1.0-20260516123512` is available from `http://120.55.188.242:8300/api/mobile-updates/check`.
  - Bundle `app-0.1.0-20260516123512.zip` returned HTTP 200 with `Content-Length: 6087325`.
- Known risks:
  - Visual taste still needs confirmation on the user's real device because the smoke screenshots do not contain the exact production reminder content shown in the user screenshot.

### Session 2026-05-16 KISS Structure Refactor

- Goal: Reduce frontend/backend structural debt while preserving existing business behavior.
- Completed:
  - Extracted frontend option/config constants from `App.tsx` into `frontend/src/appOptions.ts`.
  - Extracted the reusable `StorySelect` control from `App.tsx` into `frontend/src/components/StorySelect.tsx`.
  - Split StorySelect base styles from `styles.css` into `frontend/src/styles/story-select.css`.
  - Extracted Agent prompt text from `AgentRuntime` into `AgentPrompts`.
  - Extracted attachment MIME, dataURL, size-limit, and kind-normalization rules from `AttachmentStorageService` into `AttachmentUploadRules`.
  - Split `frontend/src/styles.css` into ordered stylesheet modules under `frontend/src/styles/`, leaving `styles.css` as the import hub.
  - Moved app state normalization, reminder/date parsing, legacy local-state, and profile helper functions from `App.tsx` into `frontend/src/appStateDomain.ts`.
  - Extracted `StorybookScene` and `AlbumVideoThumbnail` from `App.tsx` into focused component files.
  - Kept the prior state hydration KISS cleanup in `AppStateService` and related controller test alignment.
- Verification run:
  - `bash harness/init.sh`
  - `npm run build`
  - `mvn test`
  - `npm run verify:frontend`
  - `git diff --check`
- Evidence:
  - Harness smoke passed before the additional refactor.
  - Frontend build passed after component/config extraction.
  - Frontend build passed after the stylesheet/domain/component split.
  - Backend full Maven test passed: 134 tests, 0 failures.
  - Frontend smoke passed across desktop plus iPhone SE, iPhone 13, iPhone Pro Max, Android compact, Android Pixel, and Android large viewports.
- Known risks:
  - This was intentionally a low-risk structural split; `App.tsx`, `styles.css`, `AgentRuntime`, and `AttachmentStorageService` are smaller but still large enough to justify future domain-by-domain extraction after behavior-specific coverage is in place.

### Session 2026-05-14 OTA Timeout Diagnosis

- Goal: Diagnose why the mobile OTA update failed in the installed app and patch the updater timeout path.
- Completed:
  - Verified the cloud OTA check endpoint returns an update for `0.1.0-20260514185558`.
  - Verified the cloud bundle endpoint returns `200`, `Content-Length: 6086147`, and the downloaded zip checksum matches the manifest.
  - Confirmed the zip archive is valid with `unzip -t`.
  - Checked cloud logs and found mobile bundle downloads completed with `200` but took about 25 seconds.
  - Identified the likely failure: Capgo Capacitor Updater defaults `responseTimeout` to 20 seconds, so the installed native plugin can time out before the slow bundle download finishes.
  - Raised Capacitor Updater `responseTimeout` to 120 seconds and improved user-facing OTA failure copy for timeout/checksum/unzip cases.
  - Synced native projects and rebuilt Android/iOS debug targets.
  - Published a fresh OTA bundle `0.1.0-20260514190632`.
- Verification run:
  - Cloud `POST /api/mobile-updates/check`
  - Cloud `HEAD /api/mobile-updates/bundles/app-0.1.0-20260514185558.zip`
  - Local download + `shasum -a 256` + `unzip -t`
  - `npm run mobile:sync`
  - `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:android:debug`
  - `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:ios:debug`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SKIP_BACKEND_BUILD=1 ECS_HOST=120.55.188.242 SSH_KEY=<configured-key> npm run deploy:aliyun`
  - Cloud `POST /api/mobile-updates/check`
- Evidence:
  - Manifest checksum `9438f6c348102ae41824c752edcc6b8bff4afb1d14a7280241201bcfb594e1c5` matched the downloaded `0.1.0-20260514185558` zip.
  - `unzip -t` reported no archive errors.
  - Cloud logs showed `GET /api/mobile-updates/bundles/app-0.1.0-20260514185558.zip status=200 durationMs=24981` and another successful download around 25 seconds.
  - Android debug APK built at `android/app/build/outputs/apk/debug/app-debug.apk`.
  - iOS simulator build completed with `BUILD SUCCEEDED`.
  - Cloud OTA check now returns version `0.1.0-20260514190632`.
- Known risks:
  - The timeout fix changes native plugin configuration, so already-installed old packages still need a new native install before OTA becomes reliable on slow downloads.
  - Real-device OTA should be re-tested after reinstalling the new native package.

### Session 2026-05-14 Official Site Port 80 Deployment

- Goal: Publish the current official website build to Aliyun `120.55.188.242` on port `80` without touching production data.
- Completed:
  - Ran the standard harness smoke gate before deployment.
  - Rebuilt the frontend with `VITE_AGENT_API_BASE_URL=` so browser API calls use same-origin `/api` instead of a local development host.
  - Uploaded the `dist/` build to the ECS and served it from `/var/www/xiaobaoji`.
  - Installed and enabled Nginx on the ECS.
  - Configured Nginx to listen on port `80`, serve the SPA with fallback to `index.html`, cache `/assets/`, and reverse-proxy `/api/` to `127.0.0.1:8300`.
  - Ran the frontend smoke gate, then rebuilt and republished the same-origin production bundle.
- Verification run:
  - `bash harness/init.sh`
  - `npm run verify:frontend`
  - `VITE_AGENT_API_BASE_URL= npm run build`
  - `rg "localhost:8080|120\\.55\\.188\\.242:8300|/api/health" dist -n || true`
  - Remote `nginx -t`
  - Remote `curl -fsSI http://127.0.0.1/official`
  - Remote `curl -fsS http://127.0.0.1/api/health`
  - Local `curl -fsSI http://120.55.188.242/official`
  - Local `curl -fsS http://120.55.188.242/api/health`
  - Playwright smoke against `http://120.55.188.242/official`
- Evidence:
  - Harness smoke passed.
  - Frontend smoke passed across desktop and configured mobile viewports.
  - Production frontend build passed and did not contain `localhost:8080`.
  - Nginx syntax check passed and service is active.
  - ECS listeners include `0.0.0.0:80`, `[::]:80`, and backend `*:8300`.
  - Public `http://120.55.188.242/official` returned `200 OK`.
  - Public `http://120.55.188.242/api/health` returned `ok`.
  - Playwright verified title `小宝记官网`, H1 `小宝记`, and mobile scroll changed from `0` to `900`; screenshot saved under `.verification/official-site/cloud-official-mobile.png`.
- Known risks:
  - Download QR links are still placeholders until real iOS and Android package URLs are provided.

### Session 2026-05-14 Pro Trial Daily Summary OpenSpec Implementation

- Goal: Implement the OpenSpec change `add-pro-trial-daily-summary` for Pro trial application, family-scoped Pro status, AI usage logging, Pro daily summary, conservative missing-item prompts, and account-level daily summary reminders.
- Completed:
  - Added OpenSpec artifacts under `openspec/changes/add-pro-trial-daily-summary/` and marked implementation tasks through verification.
  - Added SQLite persistence for `pro_trial_application`, `pro_trial_entitlement`, `ai_usage_log`, `daily_summary`, and `daily_summary_setting`.
  - Added backend Pro APIs under `/api/pro/*` and surfaced Pro state, current daily summary, and daily summary settings in `/api/app/state`.
  - Added AI usage logging across backend model invocation paths and daily summary generation.
  - Added deterministic daily summary generation from family-shared data only, with account-private reminders/pending items shown only as current-account prompts and not persisted into the family summary payload.
  - Added frontend Pro entry points in the Record Today page, My page, and visual AI trigger path; non-Pro visual AI triggers now submit/show Pro trial flow without calling the high-cost model.
  - Added account-level daily summary reminder settings, mobile local notification scheduling, and notification click navigation to the Record Today page.
  - Added backend Pro controller tests and Agent benchmark boundary cases for gentle missing-item copy and private-content exclusion.
  - Deployed the code-only backend update to Aliyun `120.55.188.242:8300` with `SYNC_DATA=0`, preserving cloud SQLite data and uploaded files.
  - Marked the OpenSpec implementation task list complete through commit/push handoff.
- Verification run:
  - `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn" -Dtest=ProTrialControllerTests test -q`
  - `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn" test -q`
  - `npm run test:agent-benchmark`
  - `npm run build`
  - `npm run verify:frontend`
  - `npm run mobile:sync`
  - `npm run build:android:debug`
  - `npm run build:ios:debug`
  - `bash harness/init.sh`
  - `SYNC_DATA=0 ECS_HOST=120.55.188.242 SSH_KEY=<configured-key> npm run deploy:aliyun`
  - `curl -fsS http://120.55.188.242:8300/api/health`
- Evidence:
  - Backend full Maven test passed.
  - `docs/agent-benchmark-results.md` reports PASS, 15 tests, 0 failures.
  - Frontend smoke passed across desktop and configured mobile viewports.
  - Android debug APK built at `android/app/build/outputs/apk/debug/app-debug.apk`.
  - iOS simulator build completed with `BUILD SUCCEEDED`.
  - Cloud health returned `ok` after deployment.
- Known risks:
  - Daily summary generation is currently deterministic rule-based rather than a paid model call; usage is still logged as `daily_summary` for cost pipeline compatibility.
  - Daily summary reminder delivery was build-verified only; real-device notification behavior should be validated on Android/iOS before inviting beta families.
  - OpenSpec change is implemented but not archived.

### Session 2026-05-14 Frontend Directory Release Flow Check

- Goal: Verify the current release flow after moving frontend source/config into `frontend/`, without changing cloud production state.
- Completed:
  - Confirmed the standard harness smoke gate still works from the repository root.
  - Built the web app through the new `frontend/vite.config.ts` path.
  - Built an OTA bundle with `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300` and `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300`.
  - Built Android debug APK with cloud API URL.
  - Built iOS simulator debug app with cloud API URL.
  - Confirmed the current cloud health endpoint returns `ok`.
- Verification run:
  - `git diff --check`
  - `bash harness/init.sh`
  - `npm run verify:frontend`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:android:debug`
  - `VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:ios:debug`
  - `curl -fsS http://120.55.188.242:8300/api/health`
- Evidence:
  - Harness smoke passed, including frontend build and Agent benchmark.
  - Frontend verification passed across configured mobile/desktop viewports.
  - OTA bundle generated as `0.1.0-20260514151614`.
  - Android debug APK built at `android/app/build/outputs/apk/debug/app-debug.apk`.
  - iOS simulator build completed with `BUILD SUCCEEDED`.
  - Cloud health returned `ok`.
- Known risks:
  - Cloud deployment was intentionally not executed in this check because the deploy script has no dry-run mode and would restart the live service.

### Session 2026-05-14 OTA Progress Display

- Goal: Make OTA download progress truthful instead of showing a fake `0%` state until completion.
- Completed:
  - OTA download UI now starts in an indeterminate “下载中” state until the native updater emits a real positive percent.
  - Native download events are logged with their raw payload and parsed progress to help diagnose platform-specific progress behavior.
  - Frontend smoke now covers mobile update notice rendering for indeterminate and determinate progress.
  - Reminder sheet bottom spacing was widened slightly after the frontend gate exposed a 360px safe-area edge miss.
- Verification run:
  - `npm run build`
  - `npm run verify:frontend`
- Evidence:
  - `npm run build` passed.
  - `npm run verify:frontend` passed across desktop and six mobile viewports, including OTA progress notice smoke coverage.
- Known risks:
  - If the native updater only emits `0` and `100` on a platform/update path, the UI will honestly show an indeterminate download state and then completion; it will not invent intermediate percentages.

### Session 2026-05-13 Harness Baseline

- Goal: Build a repo-local harness based on the Learn Harness Engineering template, with only `AGENTS.md` at root and all new harness files under `harness/`.
- Completed:
  - Upgraded root `AGENTS.md` into the standard agent entrypoint.
  - Added harness files for feature tracking, progress, init, quality, cleanup, handoff, and evaluator rubric.
  - Kept existing frontend verification instructions and linked them into the harness rules.
- Verification run:
  - `bash harness/init.sh`
- Evidence:
  - Passed `git diff --check`.
  - Passed `npm run build`.
  - Passed `npm run test:agent-benchmark` with 13 tests, 0 failures, result written to `docs/agent-benchmark-results.md`.
- Known risks:
  - Existing uncommitted product changes predate this harness task and must not be reverted by the harness work.
- Next best action:
  - For the next feature, choose scope from `harness/feature_list.json` or add a new feature entry before implementation.

### Session 2026-05-15 Shared Contributor And Ledger Attachments

- Goal: Show a unified contributor label for records, ledger entries, and album media; hydrate and preview ledger attachments; verify the existing cloud expense `8887.24` for user `189****8653`.
- Completed:
  - Added runtime `recordedBy` metadata for family-shared state rows and care-log timeline events, using the family member role as the user-facing label.
  - Hydrated `attachmentId` and `attachmentIds` references into full attachment metadata so ledger entries can show clickable image/video/audio attachments.
  - Added frontend display for `记录人` in records, ledger, and album, plus ledger attachment preview buttons.
  - Preserved original creator attribution when existing shared rows are updated.
  - Confirmed cloud user `189****8653` belongs to family `family-eb3f4751-****`; expense `expense-1` amount `8887.24` already has attachment `attachment-mp2lomag-chc0xt`, so no production DB mutation was needed.
  - Deployed code and OTA assets to Aliyun `120.55.188.242` with production data sync disabled.
- Verification run:
  - `npm run build`
  - `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn" -q -f backend/pom.xml -Dtest=AppStateControllerTests test`
  - `npm run verify:frontend`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - `npm run test:cloud-e2e`
  - `bash harness/init.sh`
- Evidence:
  - Backend targeted test passed with contributor and expense attachment hydration coverage.
  - Frontend verification passed across desktop and configured mobile viewports.
  - Cloud health returned `ok` after deployment.
  - Cloud E2E passed 10/10 cases, including timeline `记录人`, ledger CRUD with attachment preview, album view, reminder flow, and real Agent text flow.
  - Final harness init passed with whitespace check, frontend build, and Agent benchmark.
  - Detailed iteration note is saved at `docs/record-contributor-attachment-e2e-plan.md`; E2E result is saved at `docs/automation-test-results.md`.
- Known risks:
  - The cloud `8887.24` expense fix depends on the existing linked attachment record remaining available in object/local storage; this run verified the DB relationship and new metadata hydration path, not manual visual review of the original receipt content.

### Session 2026-05-15 Album Gallery Metadata Placement

- Goal: Keep album gallery tiles visually clean and move title/date/category/recorded-by details into the click-through preview detail panel.
- Completed:
  - Removed the title and recorded-by block from album gallery tiles.
  - Added `记录人` to the album preview detail panel alongside date and category.
  - Published OTA bundle `0.1.0-20260515153705` to Aliyun `120.55.188.242`.
- Verification run:
  - `bash harness/init.sh`
  - `npm run verify:frontend`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 SKIP_BACKEND_BUILD=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/bytedance/.ssh/ai_baby_aliyun npm run deploy:aliyun`
  - Cloud `POST /api/mobile-updates/check`
- Evidence:
  - Frontend smoke passed across desktop and configured mobile viewports.
  - Cloud update check returns version `0.1.0-20260515153705`.
  - Cloud health returned `ok`.

### Session 2026-05-16 Expense Image Chat Reliability

- Goal: Fix user `137****2890` chat expense-recognition issues: multi-image sends were capped too low, expense screenshot recognition triggered meaningless web search, and recognized amounts could still be followed by an amount clarification.
- Completed:
  - Raised chat visual attachment handling from 4 to 8 to match backend request validation, including model visual input forwarding, and added a clear notice when a browser selection exceeds the chat cap.
  - Suppressed `web_search` planning/tool routing for order, receipt, invoice, payment, or expense image recognition tasks while preserving web search for policy and reference-price questions.
  - Changed expense effect resolution so complete model-recognized expenses override the rule extractor's missing-amount question, and normalized final copy when a pending expense draft already exists.
  - Added planner, effect-policy, runtime, and benchmark tests for the expense image path.
- Verification run:
  - `mvn -q -Dtest=AgentPlannerTests,EffectPolicyTests,AgentRuntimeTests,AgentBenchmarkTests test`
  - `npm run test:agent-benchmark`
  - `npm run verify:frontend`
- Evidence:
  - Targeted backend tests passed with new coverage for no expense-image web search and no redundant amount question.
  - Agent benchmark passed and refreshed `docs/agent-benchmark-results.md`.
  - Frontend verification passed across desktop and six mobile viewports, with screenshots under `.verification/frontend-smoke/`.
- Known risks:
  - Chat still intentionally caps one message at 8 visual attachments because backend validation and model input forwarding are aligned to 8; selecting more than 8 now surfaces an explicit notice instead of silently dropping extras.

### Session 2026-05-16 Agent Stream Timeout And Progress Detail

- Goal: Explain and fix why user `137****2890` saw `AI 流式响应缺少最终结果` after an 8-image expense retry, and make long-running backend work visible as concrete frontend progress.
- Completed:
  - Confirmed the failed stream timed out before the expense-recognition skill completed: 8 prior screenshots were processed as 2 sequential vision batches, the skill took about 171 seconds, while the previous SSE budget was about 165 seconds.
  - Changed stream timeout budgeting to account for planner time, expense-recognition batch count, final response generation, and a 12 minute upper cap for visual requests.
  - Added cancellation checks before expense persistence and final delivery so a timed-out/disconnected stream does not continue into user-visible side effects.
  - Changed stream trace completion to mark success only after the `final` SSE event is sent; failed final delivery is now recorded as a failed agent run.
  - Added structured progress events for planning, context preparation, media preparation, each expense-recognition batch, 支出结果整理, 账本保存, and final response generation.
  - Updated the chat UI to render backend progress as activity rows with running/completed/failed states instead of showing only a vague status line.
  - Deployed backend and OTA assets to Aliyun `120.55.188.242` with production data sync disabled.
- Verification run:
  - `mvn -f backend/pom.xml -Dtest=AgentRuntimeTests test`
  - `npm run build`
  - `npm run test:agent-benchmark`
  - `npm run verify:frontend`
  - `git diff --check`
  - `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 VITE_AGENT_API_BASE_URL=http://120.55.188.242:8300 npm run build:mobile:update`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
- Evidence:
  - `AgentRuntimeTests` passed with 23 tests, including new coverage that an 8-image previous-message retry expands stream timeout beyond the old 165 second budget while text-only requests keep the legacy budget.
  - Agent benchmark passed with 23 tests, 0 failures, and refreshed `docs/agent-benchmark-results.md`.
  - Frontend verification passed across desktop and six mobile viewports, with screenshots under `.verification/frontend-smoke/`.
  - Cloud `/api/health` returned `ok`.
  - OTA check returned version `0.1.0-20260516205323`, and the downloaded bundle checksum matched `6e95d4eb7de4776d9782648940d83f63b9d1ea62524925f4a718b1f1f968ec14`.
- Known risks:
  - This fixes timeout budgeting, cancellation, and progress visibility. It does not delete the production rows that were saved after the earlier frontend error; production data cleanup still needs explicit user confirmation of exact rows.

### Session 2026-05-16 Previous Image Retry Latency Follow-Up

- Goal: Explain and reduce why a follow-up message asking to recognize previously uploaded images was much slower than sending images directly in the same message.
- Completed:
  - Confirmed user `137****2890` latest trace `agent-1ff31579-9370-4820-ba58-be2bfa6ed1fa` started at 20:58:48, expense recognition completed at 21:01:51, and final agent response completed at 21:02:27.
  - Confirmed the two expense-recognition batches took about 86 seconds and 93 seconds respectively; the UI appeared stuck on the second batch because each batch was a blocking vision-model call with no inner progress.
  - Found the direct-image path was faster because the frontend sends agent-optimized compressed images, while previous-image retry reloaded persisted attachment originals from storage.
  - Changed historical attachment hydration for Agent input to generate an agent-sized JPEG data URL with max edge 1800px, instead of sending the original stored image bytes to the vision model.
  - Changed expense-recognition multi-batch execution to run batches concurrently using the agent executor, while preserving ordered result aggregation.
  - Changed expense persistence intent to trust planner output when it has `intent=record`, `topic=expense`, and `expense-recognition` execute mode, so ASR typos like `画飞记录一` do not block the recognized expense flow.
  - Deployed backend-only update to Aliyun `120.55.188.242` with production data sync disabled.
- Verification run:
  - `mvn -f backend/pom.xml -Dtest=AgentRuntimeTests,ExpenseRecognitionSkillTests test`
  - `npm run test:agent-benchmark`
  - `mvn -f backend/pom.xml test`
  - `git diff --check`
  - `SYNC_DATA=0 SYNC_MOBILE_UPDATES=0 ECS_HOST=120.55.188.242 SSH_KEY=/Users/yaoyibin/.ssh/ai_baby_aliyun npm run deploy:aliyun`
- Evidence:
  - Targeted runtime and expense skill tests passed with 29 tests, including concurrent batch execution and planner-record intent surviving ASR typo coverage.
  - Full backend test suite passed with 183 tests, 0 failures.
  - Agent benchmark passed with 23 tests, 0 failures, and refreshed `docs/agent-benchmark-results.md`.
  - Cloud `/api/health` returned `ok` after backend-only deploy.
- Known risks:
  - Historical screenshot OCR now uses a compressed 1800px JPEG instead of the original file; this is intended to match the direct-send path and should preserve enough resolution for order screenshots, but extremely tiny text could still depend on upstream model quality.

### Session 2026-06-05 Real User Record And Companion UX Fixes

- Goal: Fix user `189****8653` real test-path issues around chat progress clutter, deterministic feeding records, daily record nudges, voice cancellation, quick-action icon size, and care-log timeline persistence.
- Completed:
  - Changed embedded question handling so concrete records inside questions, such as `今天发生了什么？刚才9点多喝了100ml奶粉...`, still produce care-log signals and automatic record decisions.
  - Changed care-log merge semantics so daily cumulative fields (`milkMl`, `milkTimes`, `sleepHours`, `wakes`) are additive for merge patches while notes/events remain deduped; frontend optimistic merge now matches backend behavior.
  - Fixed automatic care-log persistence to send incremental patches, not already-merged full logs, preventing double counting after the additive backend change.
  - Allowed explicit milk-type clarification replies (for mixed feeding) to auto-record when the care payload already contains complete milk amount/event data.
  - Added final-copy guard so pending care-log decisions no longer say they have already been recorded.
  - Hid completed backend progress rows after final AI messages; running/failed rows remain visible while useful.
  - Added voice hold drag-to-cancel with an `上滑取消` / `松开取消` state and cancellation that restores the pre-press composer text.
  - Moved weak toast placement away from the top overlap area and enlarged quick-action icons while keeping smoke-safe mobile bounds.
  - Removed `今日交接`, missing-record prompts, unfinished-reminder prompts, and pending-confirmation nudges from the primary records view; server daily-summary read/generate now strips old missing prompt copy and returns empty missing/account-missing lists.
  - Updated frontend smoke mocks for consent gate and family member API so the UI gate reflects current app startup.
- Verification run:
  - `node scripts/test-care-log-helpers.mjs`
  - `JAVA_HOME="/Applications/IntelliJ IDEA.app/Contents/jbr/Contents/Home" "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn" -f backend/pom.xml -Dtest=AgentBenchmarkTests#benchmarkEmbeddedQuestionWithConcreteMilkRecordStillAutoWritesCareLog test -q`
  - `JAVA_HOME="/Applications/IntelliJ IDEA.app/Contents/jbr/Contents/Home" "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn" -f backend/pom.xml -Dtest=AppStateControllerTests#mergesCareLogPatchByAddingDailyTotalsAndKeepingTimelineEvents test -q`
  - `JAVA_HOME="/Applications/IntelliJ IDEA.app/Contents/jbr/Contents/Home" "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn" -f backend/pom.xml -Dtest=ProTrialControllerTests#dailySummaryGenerationPersistsSharedDataAndStripsAccountPrivateItems test -q`
  - `JAVA_HOME="/Applications/IntelliJ IDEA.app/Contents/jbr/Contents/Home" "/Applications/IntelliJ IDEA.app/Contents/plugins/maven/lib/maven3/bin/mvn" -f backend/pom.xml -Dtest=AgentBenchmarkTests test -q`
  - `npm run test:agent-l2:unit`
  - `npm run test:agent-benchmark`
  - `npm run verify:frontend`
- Evidence:
  - Frontend smoke passed across desktop and six mobile viewports; screenshots are under `.verification/frontend-smoke/`.
  - Agent benchmark passed with the new embedded-question record and no daily-summary nudge coverage.
  - Targeted backend tests passed for additive care-log merge, daily-summary missing/account prompt stripping, and agent record extraction.
  - Read-only production inspection showed the reported cloud state had `milkMl=100` while a pending effect contained the second 100ml patch; no production data was mutated in this session.
- Known risks:
  - This session did not deploy to ECS or publish OTA; cloud users will see the fix only after a separate production release.
  - Browser smoke proves layout and web interaction, but real-device ASR drag-cancel feel still needs native-device confirmation.

## Operational Notes

- Use `npm run test:agent-benchmark` for Agent behavior changes.
- Use `npm run verify:frontend` for UI or layout changes.
- Use `npm run mobile:sync` plus platform debug builds for native-risk changes.
- Use `SYNC_DATA=0 ECS_HOST=120.55.188.242 npm run deploy:aliyun` for code-only cloud updates unless the user explicitly requests data sync or reset.
