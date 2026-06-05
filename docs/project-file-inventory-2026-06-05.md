# 项目文件盘点与清理记录

- 日期：2026-06-05
- 目的：降低仓库根目录和 `docs/` 的噪声，明确哪些文件是当前入口、哪些是历史归档、哪些是本地生成物。
- 清理原则：保护未提交代码和生产/本地数据；只移动已完成历史材料；只删除可再生成或无业务价值的本地杂物。

## 1. 当前应优先读取的入口

入口清单统一维护在 `harness/project-index.md`（Read First / Active Docs Map），此处不再重复，避免一处改动要同步多份。本文件聚焦盘点与清理记录（见下文）。

## 2. 代码和运行目录分类

| 类别 | 路径 | 处理策略 |
| --- | --- | --- |
| 前端源码 | `frontend/src/` | 保留；当前仍有未提交 R0.5 改动 |
| 后端源码 | `backend/src/` | 保留；当前仍有未提交 R0.5 改动 |
| 验证脚本 | `scripts/` | 保留；包含 benchmark、frontend smoke、cloud E2E、deploy 和 OTA build |
| 原生工程 | `ios/`、`android/` | 保留；Capacitor native shell |
| Harness | `harness/` | 保留；后续 agent 的 restart source |
| OpenSpec 当前变更 | `openspec/changes/` | 当前只保留 `archive/`，无 active change |
| OpenSpec 已完成变更 | `openspec/changes/archive/` | 保留追溯；不作为待实施范围 |
| Repo-local skills | `.codex/skills/` | 保留；本仓库 OpenSpec skills |

## 3. 文档目录分类

| 类别 | 路径 | 处理策略 |
| --- | --- | --- |
| 当前产品/技术文档 | `README.md`、`docs/system-architecture.md`、`docs/agent-detailed-design.md` | 保留；README 已更新当前入口 |
| 发布与商业化 | `docs/commercialization/` | 保留；策略仍有参考价值。旧版发布评估 `release-readiness-review-2026-06-04` 已被 `2026-06-05-release-readiness-improvement-design` spec 取代并归档 |
| Benchmark 报告 | `docs/agent-benchmark-results.md`、`docs/agent-l2-benchmark-results.md`、`docs/agent-product-coverage-index.md`、`docs/app-function-coverage-index.md`、`docs/native-capability-benchmark.md` | 保留；脚本会读写或作为 coverage 证据 |
| Cloud E2E 报告 | `docs/automation-test-cases.md`、`docs/automation-test-results.md` | 保留；`scripts/cloud-feature-e2e.mjs` 会写结果文件 |
| 历史研究 | `docs/research-archive/` | 保留归档；不作为当前路线入口 |
| 已完成历史任务 | `docs/archive/completed-2026-06-05/` | 已从 `docs/` 根目录移入归档 |
| Superpowers specs/plans | `docs/superpowers/` | 保留当前 specs 和未完成计划；已完成计划统一归档 |

## 4. 可再生成或本地专属目录

这些目录不应提交，磁盘紧张时可以本地删除；重新运行对应命令会再生成。

| 路径 | 来源 | 说明 |
| --- | --- | --- |
| `node_modules/` | `npm install` | 依赖目录，保留可避免重新安装 |
| `dist/` | `npm run build` | 前端构建产物 |
| `backend/target/` | Maven 测试/构建 | 后端编译产物 |
| `.verification/` | smoke/probe/e2e 脚本 | 验证截图和 JSON 结果 |
| `android/app/build/`、`android/build/` | Android Gradle | 原生构建产物 |
| `ios/App/App/public/` | Capacitor sync | iOS Web 资源拷贝 |
| `android/app/src/main/assets/` | Capacitor sync | Android Web 资源拷贝 |

## 5. 不能随手删除的本地/生产相关数据

| 路径 | 原因 |
| --- | --- |
| `backend/data/` | 本地应用数据和 mobile-updates；可能包含 SQLite、附件、OTA manifest |
| `backend/backend/data/` | 疑似历史运行目录，包含 SQLite 和 auth secret；已识别但未删除 |
| `scripts/cloud-feature-e2e.env.local` | 本地真实云端测试账号配置，已被 `.gitignore` 忽略 |
| `.env`、`.env.*` | 本地密钥配置，已被 `.gitignore` 忽略 |
| `backups/` | 备份/恢复产物，可能含真实数据 |

## 6. 本轮已处理

### 已删除的本地杂物

- `.DS_Store`
- `frontend.log`
- `backend/backend.log`
- `backend/backend.pid`
- `.claude/launch.json`
- `.verification/`

### 已更新的忽略规则

- `.gitignore` 增加 `.claude/`，避免本地 agent 配置进入未跟踪列表。

### 已更新的入口文档

- `README.md`：补上当前路线、发布硬化 spec、功能清单和安全部署/OTA 命令。
- `docs/aliyun-ecs-deploy.md`：标注公网 IP 部署是原型路径，正式发布应迁移 HTTPS/域名。
- `harness/quality-document.md`：合并历史安全风险里仍然有效的发布阻断和技术债摘要。
- `harness/project-index.md`：新增项目总索引，解释“文件为什么还多”、哪些目录要读、哪些目录只归档或忽略。

### 已归档的文档

- `docs/codex-todo-2026-05-26-placeholder-images.md`
- `docs/growth-metrics-IMPLEMENTATION-PROGRESS.md`
- `docs/automation-completion-audit.md`
- `docs/record-contributor-attachment-e2e-plan.md`
- `docs/superpowers/plans/2026-05-26-cross-domain-daily-summary.md`
- `docs/superpowers/plans/2026-06-01-daily-summary-ai-hub.md`
- `docs/product-requirements.md`
- `docs/security-risks.md`
- `docs/superpowers/specs/2026-05-26-cross-domain-daily-summary-design.md`（今日小结已上线，配套 plan 已先归档，design 补齐）
- `docs/superpowers/specs/2026-05-26-visual-refresh-plan.md`（配色 sage 化已完成）
- `docs/superpowers/specs/2026-06-02-recording-companion-improvements-design.md`（P0/P1 已实现）
- `docs/superpowers/plans/2026-06-02-recording-companion-p0-implementation.md`
- `docs/superpowers/plans/2026-06-02-recording-companion-p1-implementation.md`
- `docs/release-readiness-review-2026-06-04.md`（被 2026-06-05 发布硬化 spec 取代）

归档位置：`docs/archive/completed-2026-06-05/`。

### 已归档的 OpenSpec 完成项

- `add-expense-recognition-skill-worker`
- `add-pro-trial-daily-summary`
- `improve-expense-agent-recording-flow`
- `standardize-agent-skill-runtime-contract`

归档位置：`openspec/changes/archive/2026-06-05/`。

## 7. 后续可继续清理的候选项

这些项目已按用户确认处理；红框中排除的项保持原样。

| 候选项 | 建议 |
| --- | --- |
| `backend/backend/data/` | 用户指定本轮不处理；目录仍包含 SQLite 和 auth secret，后续只有在确认不再被任何本地 profile 使用后才能清理 |

## 8. 后续 agent 规则

1. 选择功能范围前先读 `harness/feature_list.json` 和 `harness/app-development-roadmap.md`。
2. 不从 `docs/archive/` 或 `docs/research-archive/` 推导新方向。
3. 不把 `node_modules/`、`dist/`、`backend/target/`、`.verification/` 当作需要维护的源码。
4. 删除 `backend/data/`、`backend/backend/data/`、`backups/` 前必须得到明确确认。
5. 运行 benchmark 后如果只刷新时间戳和耗时，先确认是否是本轮需要的证据，再决定是否保留 diff。
