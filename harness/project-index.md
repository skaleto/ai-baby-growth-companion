# Project Index

Updated: 2026-06-05

This is the top-level navigation map for this repository. Use it to decide what to read first, what to ignore, and where to put new work.

## Read First

| Need | Read |
| --- | --- |
| Current verified state and latest handoff | `harness/claude-progress.md` |
| Current product direction | `harness/app-development-roadmap.md` |
| Feature state and evidence tracker | `harness/feature_list.json` |
| Release hardening requirements | `docs/superpowers/specs/2026-06-05-release-readiness-improvement-design.md` |
| Product function inventory and coverage owner | `docs/feature-inventory.md` |
| Quality and risk snapshot | `harness/quality-document.md` |
| Detailed file cleanup record | `docs/project-file-inventory-2026-06-05.md` |

Do not infer current product direction from `docs/archive/`, `docs/research-archive/`, or archived OpenSpec changes.

## Directory Map

| Directory | What It Is | Daily Handling |
| --- | --- | --- |
| `frontend/src/` | React + Capacitor app source | Read when changing UI, app state, views, mobile interactions |
| `backend/src/` | Spring Boot backend source | Read when changing auth, family state, agent, uploads, OTA, data rights |
| `scripts/` | Verification, benchmark, deploy, OTA, smoke, cloud E2E scripts | Keep; use before claiming evidence |
| `harness/` | Agent restart and handoff source | Read first; update after substantial work |
| `docs/` | Active product, architecture, benchmark, ops, and specs | Keep active docs here only when they guide current work |
| `docs/archive/` | Completed historical tasks | Reference only; not a current task source |
| `docs/research-archive/` | Competitor, market, and strategy research history | Reference evidence only; current strategy lives in harness |
| `openspec/changes/archive/` | Completed OpenSpec changes | Trace history only; not active scope |
| `ios/`, `android/` | Native Capacitor shells | Keep; validate with native gates when touched |
| `.codex/skills/` | Repo-local agent skills | Keep; used by OpenSpec workflow |

## Active Docs Map

| Area | Docs |
| --- | --- |
| Product direction | `harness/app-development-roadmap.md`, `docs/feature-inventory.md` |
| Release readiness | `docs/superpowers/specs/2026-06-05-release-readiness-improvement-design.md`, `docs/ops/` |
| Agent benchmark and coverage | `docs/agent-benchmark-plan.md`, `docs/agent-benchmark-results.md`, `docs/agent-l2-benchmark-results.md`, `docs/agent-product-coverage-index.md`, `docs/app-function-coverage-index.md`, `docs/native-capability-benchmark.md` |
| Architecture | `docs/system-architecture.md`, `docs/agent-detailed-design.md`, `docs/assets/architecture/` |
| Frontend verification | `docs/frontend-verification.md`, `docs/frontend-directory-structure.md` |
| Commercialization and legal drafts | `docs/commercialization/` |
| Deployment and OTA | `docs/aliyun-ecs-deploy.md`, `docs/mobile-updates.md`, `docs/ops/ota-incident-2026-06-05.md` |
| Superpowers active work | `docs/superpowers/specs/`, `docs/superpowers/plans/` |

## File Count Snapshot

This repo still looks large because it includes source, native shells, generated dependencies, and archived evidence.

Snapshot after cleanup on 2026-06-05:

| Bucket | Count / Size | Interpretation |
| --- | --- | --- |
| `node_modules/` | 159M | Generated dependency directory; do not read manually |
| `android/` | 83M, 146 source/config files outside build dirs | Native shell and Gradle config; expected for Capacitor |
| `backend/` | 81M, 310 source/config files outside `target/` | Main Java backend plus resources and tests |
| `ios/` | 20M, 65 source/config files | Native shell; expected for Capacitor |
| `frontend/` | 5.3M, 82 source/config files | Main React app |
| `docs/` | 804K, 62 files total | 45 active docs plus 17 archived/research docs |
| `scripts/` | 464K, 36 files | Verification and operational scripts |
| `harness/` | 224K, 10 files after this index | Current agent restart source |

The practical read set for most product work is 6-8 files, not the full tree.

## Generated Or Local-Only Paths

Do not treat these as source:

- `node_modules/`
- `dist/`
- `backend/target/`
- `.verification/`
- `android/app/build/`, `android/build/`
- `ios/App/App/public/`, `android/app/src/main/assets/`
- `.DS_Store`, `*.log`, `*.pid`

These may be deleted locally when needed, except dependency directories may need reinstall or rebuild.

## Data And Secret Safety

Do not delete, migrate, or sync these without explicit user confirmation:

- `backend/data/`
- `backend/backend/data/`
- `backups/`
- `.env`, `.env.*`
- `scripts/cloud-feature-e2e.env.local`

The current user-confirmed exception is that `backend/backend/data/` must stay untouched for this cleanup round.

## Where New Work Goes

| Work Type | Location |
| --- | --- |
| Current progress / handoff | `harness/claude-progress.md` |
| Feature state or evidence | `harness/feature_list.json` |
| Product roadmap changes | `harness/app-development-roadmap.md` |
| Release hardening requirements | `docs/superpowers/specs/2026-06-05-release-readiness-improvement-design.md` or a new dated spec |
| Implementation plans | `docs/superpowers/plans/` while active; move to `docs/archive/` when completed |
| Benchmark output | Existing benchmark result docs only when the output is meaningful, not timestamp-only |
| Market or competitor research | `docs/research-archive/` |

## Quick Commands

```bash
bash harness/init.sh
git diff --check
npm run build
npm run test:agent-benchmark
npm run verify:frontend
find . -name .DS_Store -delete
```
