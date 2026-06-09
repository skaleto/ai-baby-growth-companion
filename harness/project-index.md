# Project Index

Top-level navigation map for this repository. Use it to decide what to read first, what to ignore, and where to put new work. History of past sessions and deleted decisions lives in git.

## Read First

| Need | Read |
| --- | --- |
| Feature state, validation, and evidence | `harness/feature_list.json` |
| Current product direction | `harness/app-development-roadmap.md` |
| Agent model context and bad-case harness | `harness/agent-model-context-harness.md` |
| Quality and risk snapshot | `harness/quality-document.md` |
| System / agent architecture | `docs/architecture/system-architecture.md`, `docs/architecture/agent-design.md` |
| Product function inventory and coverage | `docs/product/feature-inventory.md` |
| Frontend verification gate | `docs/verification/frontend-verification.md` |
| Release hardening requirements | `docs/release/release-readiness.md` |

## Directory Map

| Directory | What It Is | Daily Handling |
| --- | --- | --- |
| `frontend/src/` | React + Capacitor app source | Read when changing UI, app state, views, mobile interactions |
| `backend/src/` | Spring Boot backend source | Read when changing auth, family state, agent, uploads, OTA, data rights |
| `scripts/` | Verification, benchmark, deploy, OTA, smoke, cloud E2E scripts | Keep; use before claiming evidence |
| `harness/` | Agent restart, model-context harness, feature/quality tracking | Read first; update after substantial work |
| `docs/` | Architecture, product, verification, benchmark, release, ops, legal | Active docs only |
| `openspec/` | Optional spec-driven change workflow (`config.yaml` + `specs/`) | Use when running OpenSpec changes |
| `ios/`, `android/` | Native Capacitor shells | Validate with native gates when touched |
| `.codex/skills/` | Repo-local agent skills | Used by the OpenSpec workflow |

## Docs Map

| Area | Docs |
| --- | --- |
| Architecture | `docs/architecture/system-architecture.md`, `docs/architecture/agent-design.md`, `docs/architecture/frontend-directory-structure.md`, `docs/architecture/diagrams/` |
| Product | `harness/app-development-roadmap.md`, `docs/product/feature-inventory.md` |
| Verification | `docs/verification/frontend-verification.md` |
| Benchmark and coverage | `docs/benchmark/benchmark-plan.md`, `docs/benchmark/agent-capability-benchmark.md`, `docs/benchmark/agent-product-coverage-index.md`, `docs/benchmark/app-function-coverage-index.md`, `docs/benchmark/native-capability-benchmark.md` |
| Release | `docs/release/release-readiness.md` |
| Deployment and OTA | `docs/ops/aliyun-ecs-deploy.md`, `docs/ops/mobile-updates.md`, `docs/ops/ota-incident-2026-06-05.md`, `docs/ops/https-domain-setup.md` |
| Legal and data | `docs/legal/` |

## Generated Or Local-Only Paths

Do not treat these as source:

- `node_modules/`, `dist/`, `backend/target/`, `.verification/`
- `android/app/build/`, `android/build/`, `ios/App/App/public/`, `android/app/src/main/assets/`
- `docs/*-results.md` (script-generated benchmark output; gitignored)
- `.DS_Store`, `*.log`, `*.pid`

## Data And Secret Safety

Do not delete, migrate, or sync these without explicit user confirmation:

- `backend/data/`, `backend/backend/data/`
- `backups/`
- `.env`, `.env.*`
- `scripts/cloud-feature-e2e.env.local`

## Where New Work Goes

| Work Type | Location |
| --- | --- |
| Feature state or evidence | `harness/feature_list.json` |
| Product roadmap changes | `harness/app-development-roadmap.md` |
| Release hardening requirements | `docs/release/release-readiness.md` |
| Architecture changes | `docs/architecture/` |
| Benchmark / coverage updates | `docs/benchmark/` |

## Quick Commands

```bash
bash harness/init.sh
git diff --check
npm run build
npm run test:agent-benchmark
npm run verify:frontend
find . -name .DS_Store -delete
```
