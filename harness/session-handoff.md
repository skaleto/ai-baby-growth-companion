# Session Handoff

Updated: 2026-06-06

## Current Verified State

- Repo: `/Users/bytedance/Documents/ai-baby-growth-companion`
- Branch: `main`
- Baseline at start of cleanup passed:
  - `bash harness/init.sh`
  - inside it: `git diff --check`, `npm run build`, `npm run test:agent-benchmark`
- Worktree is dirty from previous product/Agent/UI work. Preserve unrelated changes.

## Compressed Context

The current implementation should combine two 2026-06-06 directions:

1. Product / IA direction:
   - `docs/superpowers/specs/2026-06-06-module-native-ai-records-album-ledger-spec.md`
   - `docs/superpowers/specs/2026-06-06-product-simplification-records-trust-spec.md`
   - `docs/research-archive/records-album-domestic-app-research-2026-06-06.md`
   - `harness/app-development-roadmap.md`
2. Agent action architecture:
   - `docs/superpowers/specs/2026-06-06-agent-tool-first-recording-architecture-spec.md`
   - `docs/agent-detailed-design.md`

Do not use May decision docs. They were deleted from the workspace on 2026-06-06.

## Current Product Decisions

- Product boundary: recording and companionship.
- Do not add ecommerce, experts, paid knowledge content, or open community.
- Target navigation: `记录 / 相册 / 账本 / 我的`.
- `记录` is the default home and owns quick recording, today timeline, growth data, trends, and calendar.
- AI is module-native:
  - records: lightweight text/voice "记一笔";
  - album: by-day media timeline first;
  - ledger: manual ledger plus later Pro image recognition.
- User-facing model selection, deep-thinking, and fast-mode controls should remain hidden/system-adaptive.

## Current Agent Decisions

- P0 is records + ledger only.
- AI reminder/todo tools are out of scope.
- Tool names:
  - `record_feeding_event`
  - `create_growth_measurement_pending`
  - `create_expense_pending`
- `pending` means backend-persisted `pending_effect`, visible through `/api/app/state`.
- Final AI reply must be based on `AgentActionResult`.
- After migration, `RecordSignalExtractor` and `EffectPolicy` must not be the main write path for P0 record/ledger side effects.

## Cleanup Performed

Deleted:

- `docs/archive/completed-2026-06-05/`
- `docs/automation-test-cases.md`
- `docs/automation-test-results.md`
- `docs/project-file-inventory-2026-06-05.md`
- `docs/ledger-feature-plan.md`
- `docs/superpowers/specs/2026-06-04-agent-latency-audit.md`
- `docs/superpowers/specs/2026-06-05-agent-architecture-optimization.md`

Updated:

- `harness/claude-progress.md`
- `harness/project-index.md`
- `harness/quality-document.md`
- `harness/app-development-roadmap.md`
- `docs/system-architecture.md`
- `docs/agent-detailed-design.md`
- `docs/archive/README.md`
- `docs/superpowers/specs/2026-06-05-release-readiness-improvement-design.md`
- `docs/superpowers/specs/2026-06-04-agent-capability-benchmark.md`

## Next Best Action

Write and execute an implementation plan in two batches:

1. Product shell batch:
   - make records the default home;
   - remove independent chat bottom tab if still present;
   - ensure reminders are managed from My, not a bottom tab;
   - prepare records-page AI input surface if current code still routes through chat;
   - make album grouping by day if not already done.
2. Agent tool-first batch:
   - add action tool abstractions and tests;
   - implement `record_feeding_event`;
   - implement `create_growth_measurement_pending`;
   - implement `create_expense_pending`;
   - wire final reply to tool results;
   - remove/fence old P0 writes from `RecordSignalExtractor + EffectPolicy`.

## Required Verification

- Docs-only cleanup: `git diff --check`.
- Product UI/navigation changes: `npm run verify:frontend`.
- Agent behavior changes: targeted Maven tests + `npm run test:agent-benchmark`.
- If publishing later, follow AGENTS OTA production URL rules exactly.

## Do Not Touch Without Explicit Request

- `backend/data/`
- `backend/backend/data/`
- `backups/`
- `.env*`
- production SQLite/auth secrets
