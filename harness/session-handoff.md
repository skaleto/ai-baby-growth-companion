# Session Handoff

Updated: 2026-06-07

## Current Verified State

- Repo: `/Users/bytedance/Documents/ai-baby-growth-companion`
- Branch: `main`
- Baseline at start of cleanup passed:
  - `bash harness/init.sh`
  - inside it: `git diff --check`, `npm run build`, `npm run test:agent-benchmark`
- Agent tool-first cutover verification passed on 2026-06-07:
  - targeted Maven action-tool/runtime tests
  - `mvn -f backend/pom.xml test`
  - `npm run test:agent-benchmark`
  - `npm run test:agent-l2:unit`
  - `npm run verify:frontend`
- Product IA and native media date verification passed on 2026-06-07:
  - `npm run test:album-domain`
  - `node scripts/test-media-capture-date.mjs`
  - `npm run test:product-simplification`
  - `npm run build`
  - `npm run test:agent-l2:unit`
  - `npm run verify:frontend`
  - `npm run mobile:sync`
  - `npm run build:ios:debug`
  - `npm run build:android:debug`
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
3. Current implementation plan:
   - `docs/superpowers/plans/2026-06-06-module-native-ai-tool-first-implementation.md`

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
- Migration must be a full cutover for retained Records/Ledger AI write paths, not a feeding-first or half-old/half-new production state.
- Tool names include:
  - `record_feeding_event`
  - `record_sleep_event`
  - `record_diaper_event`
  - `record_temperature_event`
  - `create_growth_measurement_pending`
  - `create_growth_event_pending` / `create_milestone_pending`
  - `create_expense_pending`
- `pending` means backend-persisted `pending_effect`, visible through `/api/app/state`.
- Final AI reply must be based on `AgentActionResult`.
- `RecordSignalExtractor` and `EffectPolicy` should be deleted or fully disconnected from production Agent write paths; do not keep fallback, shadow, or compatibility behavior.
- If an old AI write capability is not rebuilt as an action tool in this cutover, remove it from prompts/capability manifest and return a manual-entry/unsupported boundary.

## Agent Cutover Implemented

- Backend action tools now own retained Records/Ledger AI writes:
  - `record_feeding_event`
  - `record_sleep_event`
  - `record_diaper_event`
  - `record_temperature_event`
  - `create_growth_measurement_pending`
  - `create_milestone_pending`
  - `create_expense_pending`
- `AgentMutationService` is the backend mutation boundary for agent-applied `careLogs` and persisted `pendingEffects`.
- Old production write-chain classes were deleted:
  - `RecordSignalExtractor`
  - `EffectPolicy`
  - `CareEventCompletenessPolicy`
- Frontend Records/Ledger pending data should come from refreshed app state / persisted `pendingEffects`, not local reconstruction from transient model `effectDecisions`.
- `capability-manifest.json` disables AI reminder/todo, AI memory-write, and AI album-save write capabilities for this migration.

## Product IA Implemented

- Records is the default mobile home.
- Mobile bottom navigation is now `记录 / 相册 / 账本 / 我的`.
- Independent chat and reminder bottom tabs are removed.
- Records owns the lightweight AI composer and quick input actions.
- Reminder management is entered through My and quick reminder templates open manual drafts.
- Album groups media by day-level `occurredAt`.
- Uploads now keep media capture time separate from upload time:
  - native iOS/Android picker returns `capturedAt` when OS metadata is available;
  - frontend falls back through JPEG EXIF, file `lastModified`, then upload timestamp.

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

1. Live model validation, only when explicitly budget-approved:
   - feeding applied write appears in `careLogs`;
   - growth/ledger creates persisted `pendingEffects`;
   - reminder/todo requests do not mutate app state.
2. Real-device validation when needed:
   - native media picker capture date on real iOS/Android photos;
   - notifications/full-screen ringing;
   - ASR microphone path;
   - OTA apply.
3. Deploy ECS/OTA only after the user explicitly asks and follow AGENTS production base-URL rules.

## Required Verification

- Docs-only cleanup: `git diff --check`.
- Product UI/navigation changes: `npm run verify:frontend`.
- Agent behavior changes: targeted Maven tests + `npm run test:agent-benchmark` + `npm run test:agent-l2:unit`.
- If publishing later, follow AGENTS OTA production URL rules exactly.

## Do Not Touch Without Explicit Request

- `backend/data/`
- `backend/backend/data/`
- `backups/`
- `.env*`
- production SQLite/auth secrets
