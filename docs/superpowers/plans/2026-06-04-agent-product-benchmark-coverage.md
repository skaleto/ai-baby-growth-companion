# AI Agent Product Function Benchmark Coverage Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI agent benchmark cover the product functions users rely on, especially record-first companion flows, growth data, reminders, ledger, album, safety, and data-linked daily companionship.

**Architecture:** Keep L0/L1 backend tests as the deterministic policy gate. Use L2 scenarios as the product-function gate: real `/api/agent/chat/stream`, optional scenario state setup, simulated frontend effect application, then `/api/app/state` diff plus structural and judge scoring. Use the product coverage index to map non-agent app features to their proper frontend/backend/cloud/native gates. Product features that are not yet agent-wired must appear as explicit known gaps instead of disappearing from the benchmark.

**Tech Stack:** Node ESM scripts, Spring Boot agent API, app_state REST API, DeepSeek judge, existing `AgentBenchmarkTests`.

---

## Current Coverage Matrix

| Product function area | L0/L1 coverage | L2 scenario status | Gap / next action |
|---|---:|---:|---|
| Feeding record | yes | runnable: `feed-complete`, `feed-boundary`, `feed-mixed-missing-type` | Mixed-feeding missing type is now an explicit ask/no-write L2 boundary. |
| Sleep record | yes | runnable: `sleep-complete`, `sleep-start-boundary` | Start-only sleep is now an explicit ask/no-write L2 boundary. |
| Health/safety record | yes | runnable: `fever-risk`, `safety-refuse`, `medicine-reminder-pending`, `vaccine-reminder-pending` | Health reminder boundaries now require pendingEffects instead of direct reminders. |
| Reminder creation | yes | runnable: `reminder-once`, `reminder-interval`, `vague-reminder-ask`, `medicine-reminder-pending`, `vaccine-reminder-pending` | Add more non-milk interval variants after first full L2 run. |
| Ledger AI draft | yes | runnable: `expense-record` | L2 now checks `pendingEffects.expenses`; add confirm-pending API flow later. |
| Growth milestone/event | partial | runnable: `growth-milestone` | First executable growth case now covered as pendingEffect. |
| Growth measurements | yes | runnable: `growth-measurement-complete`, `growth-measurement-ambiguous-unit`, `growth-measurement-out-of-range`, `growth-measurement-update-boundary`, `growth-measurement-delete-boundary`, `growth-measurement-duplicate-boundary` | Creation, missing unit, impossible values, chat update/delete boundaries, and duplicate same-day same-type no-write behavior are covered. |
| Data-linked companion | prompt only | runnable: `daily-observation-context`, `caregiver-fatigue-context` | Uses seeded careLogs + growthMeasurements; fatigue case asserts low-anxiety support without diagnosis or fabricated data. |
| Album auto-save / ignore | frontend-domain yes | runnable: `photo-album`, `screenshot-ignore` | `test-album-domain` covers chat photo auto-save + screenshot ignore; backend L2 now uses deterministic dataUrl fixtures to verify explicit photo save and screenshot no-save boundaries. |
| Policy/web search | yes | runnable: `qa-policy` | Need stable source assertion after tool event reporting is calibrated. |
| Care Q&A | yes | runnable: `qa-care`, `qa-care-no-memory-pollution`, `qa-care-allergy-context` | Generic Q&A now asserts no careLog/pendingEffect/memory pollution; allergy-memory case asserts context use without new state mutation. |
| Read-only product queries | yes | runnable: `read-only-reminder-list-context`, `read-only-growth-trend-context`, `read-only-daily-summary-context`, `read-only-weekly-summary-context` | Seeded reminders/growth/care data must be answered without creating reminders, careLogs, pendingEffects, memories, or growth records; aiText hard assertions prevent accidental "I'll set it / I'll record it" copy. |
| Memory/private state | partial | runnable: `memory-health-pending`, `memory-preference-pending`, `memory-caregiver-pending`, `private-reminder-share-boundary`; no-pollution checks in reminder/context cases | Private reminder sharing boundary is covered; broader cross-user/cloud role isolation remains separate. |
| Profile maintenance | boundary only | runnable: `profile-update-boundary` | Chat cannot update profile; benchmark asserts boundary copy and no pendingEffects/profile mutation. |
| ASR/voice | API/UI/native elsewhere | not L2 agent | `native-capability-audit` tracks ASR static evidence; add transcript-to-agent scenario only after ASR fixture exists and device probe exists. |
| Shared/read-only role | API/UI elsewhere | not L2 agent | Add forbidden agent call with viewer token in cloud E2E, not default local L2. |
| Whole-app feature coverage index | yes | fast gate: `test-agent-product-coverage-index` | Maps every `harness/feature_list.json` feature to L2, L0/L1, frontend, backend, cloud, native, docs, or known-gap evidence. |
| Native/mobile capabilities | static audit | fast gate: `test-native-capability-audit` | Tracks ASR, notifications, full-screen ringing, haptics, native media picker, OTA, and safe-area/keyboard as explicit device-gated capabilities. |
| Feature-inventory function rows | yes | fast gate: `test-app-function-coverage-index` | Maps all 97 rows in `docs/feature-inventory.md` to coverage owners or explicit known gaps, including the explicit growth data maintenance domain. |

## Implemented In This Pass

- [x] Added `scripts/test-l2-effect-apply.mjs` to prove frontend-style effect application writes `careLogs`, `reminders`, and `pendingEffects`.
- [x] Added `scripts/l2-benchmark/effect-apply.mjs` and wired it into `scripts/agent-l2-benchmark.mjs`.
- [x] Added scenario-level app_state reset and `setupState` seeding for data-linked companion cases.
- [x] Added `growth-milestone` as the first executable growth product scenario.
- [x] Added `growth-measurement-complete` as a runnable L2 scenario for height/weight/head circumference pending drafts.
- [x] Added `daily-observation-context` with seeded care + growth data.
- [x] Added record-boundary L2 scenarios for mixed feeding missing type, sleep start, multi-event care logging, and vague reminder asks.
- [x] Added `scripts/test-album-domain.mjs` for chat photo auto-save, screenshot ignore, non-media ignore, and duplicate attachment de-dupe.
- [x] Added `npm run test:agent-l2:unit` as the fast local unit gate for benchmark infrastructure.
- [x] Tightened `expense-record` so pending账本草稿 must appear in `pendingEffects.expenses`, not merely avoid final `expenses`.
- [x] Added health reminder boundary scenarios for medicine and vaccine reminders; both must stay pending before final creation.
- [x] Added `growth-measurement-ambiguous-unit` so ambiguous weight values ask for 斤/公斤.
- [x] Added `memory-health-pending` plus deterministic rule coverage for explicit health memories.
- [x] Added preference and caregiver-memory L2 cases so long-term context creation is pending-first, not silently written.
- [x] Added allergy-memory care Q&A and caregiver-fatigue companion cases; both assert no app_state pollution.
- [x] Added `profile-update-boundary` so profile maintenance is visible as an explicit unsupported chat boundary.
- [x] Added `growth-measurement-out-of-range` so impossible values ask for confirmation and do not enter pendingEffects.
- [x] Added `qa-care-no-memory-pollution` so ordinary育儿问答 does not become a careLog or memory draft.
- [x] Added `growth-measurement-duplicate-boundary` as a runnable same-day same-type duplicate measurement boundary.
- [x] Added `growth-measurement-update-boundary` and `growth-measurement-delete-boundary` so chat requests to change/delete existing growth data stay as non-mutating boundaries.
- [x] Added AppState controller coverage for manual growthMeasurement update/delete maintenance.
- [x] Added `scripts/l2-benchmark/assertions.mjs` and `scripts/test-l2-assertions.mjs` so L2 scenarios can hard-assert user-facing `aiText`, not only effectDecisions/app_state.
- [x] Added read-only reminder list and growth-trend L2 scenarios with seeded app_state and no-mutation assertions.
- [x] Added `private-reminder-share-boundary` so personal reminder sharing/sync requests are explicit non-mutating boundaries.
- [x] Added daily/weekly summary read-only L2 scenarios with seeded careLogs/growthMeasurements/reminders and hard assertions against care-record follow-up copy.
- [x] Unskipped `photo-album` and `screenshot-ignore` with deterministic image dataUrl fixtures so backend visual/album L2 coverage is executable.
- [x] Added `scripts/l2-benchmark/product-coverage-index.mjs`, `scripts/test-agent-product-coverage-index.mjs`, and `docs/agent-product-coverage-index.md` so every harness feature is mapped to an explicit benchmark/proof layer.
- [x] Added `scripts/native-capability-audit.mjs`, `scripts/test-native-capability-audit.mjs`, and `docs/native-capability-benchmark.md` so `mobile-001` known gaps are explicit capability contracts instead of one vague row.
- [x] Added `scripts/l2-benchmark/app-function-coverage-index.mjs`, `scripts/test-app-function-coverage-index.mjs`, and `docs/app-function-coverage-index.md` so every P0/P1/P2 function row in `docs/feature-inventory.md` has coverage ownership or a known gap.
- [x] Split growth data maintenance into explicit feature-inventory rows for latest-value entry, manual add/delete, future edit UI, AI pending confirmation, boundary handling, and read-only trend queries.
- [x] Extended frontend smoke so the growth flow now records a valid measurement, deletes that newly added history row, and verifies the row disappears across the viewport matrix.

## Next Implementation Batches

### Batch 1: Broaden Growth Measurement Boundaries

- [x] Add rule extraction for `height`, `weight`, and `headCircumference`.
- [x] Extend `EffectPolicy` to emit pending `growthMeasurement` decisions for height/weight/head circumference.
- [x] Extend frontend pending effect UI and server confirm flow to handle growth measurements.
- [x] Assert `growth-measurement-complete` writes all recognized measurements into `pendingEffects.growthMeasurements`.
- [x] Add missing-weight-unit L2 case so `体重14` asks for 斤/公斤 instead of entering pending data.
- [x] Add invalid/out-of-range L2 cases so impossible values ask or refuse instead of entering pending data.
- [x] Add chat update/delete boundaries so `体重7.4kg改成7.5kg` and `删掉今天的体重记录` do not create duplicate pending growth data or claim mutation success.
- [x] Add AppState controller coverage for manual growth data update/delete.
- [x] Connect existing `growthMeasurements` context into `EffectPolicy` so duplicate same-day same-type values ask/no-write instead of generating duplicate pending drafts.
- [x] Ensure duplicate growth measurement final copy does not invite another record when the rule-level ask already says the value exists.

### Batch 2: Complete Record Boundary Coverage

- [x] Add L2 `feed-mixed-missing-type` for mixed feeding without milk type; expect ask and no careLogs growth.
- [x] Add L2 `sleep-start-boundary`; expect ask and no careLogs growth.
- [x] Add L2 `multi-care-events`; expect one careLog with milk + sleep + poop events.
- [x] Add L2 `vague-reminder-ask`; expect ask and no reminders growth.

### Batch 3: Media And Album Coverage

- [x] Add frontend-domain benchmark coverage for chat photo auto-save, screenshot ignore, and duplicate attachment de-dupe.
- [x] Add deterministic image dataUrl fixtures for backend image scenarios.
- [x] Keep image scenario preparation in the scenario definitions so the runner can send attachments without an upload pre-step.
- [x] Unskip `photo-album` and `screenshot-ignore`.
- [ ] Add follow-up "save previous video to album" scenario after attachment hydration is stable.

### Batch 4: Data-Linked Companion And Memory

- [x] Add seeded allergy/profile context case for care Q&A.
- [x] Add caregiver fatigue companion case with existing careLogs; expect no diagnosis and no fabricated data.
- [x] Add health memory pending case for explicit "记住" health/allergy clues.
- [x] Keep no-memory-pollution checks on interval reminders and data-linked companion scenarios.
- [x] Add broader preference/caregiver memory cases.
- [x] Add no-memory-pollution cases for generic Q&A.

### Batch 5: Profile And Access Boundaries

- [x] Add profile update boundary case: chat should guide to profile UI and never claim the nickname was changed.
- [x] Add private reminder share/sync boundary: chat should not claim personal reminders were synced to family members or ask for a new reminder time.
- [ ] Add read-only/viewer role L2 cloud case for forbidden agent writes.
- [ ] Add profile creation/maintenance UI smoke coverage if product later allows chat-assisted profile changes.

### Batch 6: Read-only Product Queries

- [x] Add reminder-list query with seeded reminder; expect no new reminders or pendingEffects and no "set time" follow-up.
- [x] Add growth-trend query with seeded growthMeasurements; expect no new growth records and concrete values in aiText.
- [x] Add daily/weekly summary read-only query with seeded care/growth/reminder fixtures; expect no new records or "tell me ml so I can record" follow-up.

### Batch 7: Whole-app Coverage Index

- [x] Add a machine-checkable coverage index mapping every `harness/feature_list.json` feature to L2, L0/L1, frontend, backend, cloud, native, docs, or known-gap evidence.
- [x] Add a fast test that fails if a new feature is added without coverage ownership, or if the index references missing/skipped L2 scenarios.
- [x] Add a human-readable coverage index document for future agent handoff.
- [x] Add a native capability audit that maps `mobile-001` into `asr-voice-input`, `local-notifications`, `full-screen-ringing`, `haptics`, `native-media-picker`, `ota-updater`, and `safe-area-keyboard` with static evidence and manual probe requirements.
- [x] Add a function-row coverage index that maps the detailed `docs/feature-inventory.md` table rows to coverage owners or known gaps, below the coarse `harness/feature_list.json` index.
- [ ] Add real native/device probes for `mobile-001` gaps: ASR, notifications, full-screen ringing, haptics, native media picker, OTA apply, and WebView-only behavior.

## Gate Commands

```bash
npm run test:agent-l2:unit
node scripts/test-agent-product-coverage-index.mjs
node scripts/test-native-capability-audit.mjs
node scripts/test-app-function-coverage-index.mjs
npm run test:agent-benchmark
npm run test:agent-l2 -- --only feed-complete,feed-mixed-missing-type,sleep-start-boundary,multi-care-events,vague-reminder-ask,medicine-reminder-pending,vaccine-reminder-pending,expense-record,growth-milestone,growth-measurement-complete,growth-measurement-ambiguous-unit,growth-measurement-out-of-range,growth-measurement-update-boundary,growth-measurement-delete-boundary,growth-measurement-duplicate-boundary,photo-album,screenshot-ignore,memory-health-pending,memory-preference-pending,memory-caregiver-pending,daily-observation-context,qa-care-no-memory-pollution,qa-care-allergy-context,caregiver-fatigue-context,profile-update-boundary,read-only-reminder-list-context,read-only-growth-trend-context,read-only-daily-summary-context,read-only-weekly-summary-context,private-reminder-share-boundary --runs 1
```

`npm run test:agent-l2` still requires a running local backend and valid `L2_INVITE_CODE`; when unavailable, the report should say BLOCKED rather than pretending coverage passed.

## Latest Real L2 Evidence

2026-06-04 fast gate `npm run test:agent-l2:unit` now includes `scripts/test-agent-product-coverage-index.mjs` and `scripts/test-native-capability-audit.mjs`.
The new index maps every `harness/feature_list.json` feature to an explicit coverage layer and documents non-L2 gates such as `verify:frontend`, cloud probes, native builds, AppState controller tests, Pro trial tests, and current mobile/device known gaps. See `docs/agent-product-coverage-index.md`.

2026-06-04 native capability audit passed: `asr-voice-input`, `local-notifications`, `full-screen-ringing`, `haptics`, `native-media-picker`, `ota-updater`, and `safe-area-keyboard` all have static evidence and manual probe requirements. This is a contract/known-gap audit, not a device-delivery proof. See `docs/native-capability-benchmark.md`.

2026-06-04 app function coverage index passed: all 90 function rows parsed from `docs/feature-inventory.md` now map to coverage owners or explicit known gaps. This catches misses below the coarse `harness/feature_list.json` layer. See `docs/app-function-coverage-index.md`.

2026-06-04 local backend `http://localhost:8080` passed 8/8 for the growth-maintenance plus visual/album补缺 batch:
`growth-measurement-complete`, `growth-measurement-ambiguous-unit`, `growth-measurement-out-of-range`, `growth-measurement-update-boundary`, `growth-measurement-delete-boundary`, `growth-measurement-duplicate-boundary`, `photo-album`, `screenshot-ignore`。
This run makes the recent growth-data maintenance feature explicit in the benchmark: AI新增待确认、缺单位、异常值、聊天改删边界、重复值边界 all passed, and `photo-album` / `screenshot-ignore` are no longer skipped. See `docs/agent-l2-benchmark-results.md`.

2026-06-04 local backend `http://localhost:8080` passed 5/5 for the newest product-gap batch:
`memory-preference-pending`, `memory-caregiver-pending`, `qa-care-allergy-context`, `caregiver-fatigue-context`, `profile-update-boundary`.
See `docs/agent-l2-benchmark-results.md`.

2026-06-04 local backend `http://localhost:8080` passed 2/2 runnable for the growth/Q&A boundary batch:
`growth-measurement-out-of-range`, `qa-care-no-memory-pollution`; at that point duplicate growth data was still reported as a known gap and was later fixed.

2026-06-04 local backend `http://localhost:8080` passed 2/2 for the growth maintenance boundary batch:
`growth-measurement-update-boundary`, `growth-measurement-delete-boundary`。两者均预置已有 `growthMeasurements` 后验证 chat 不直接改/删历史成长数据、不新增 `pendingEffects`，judge 为 5/5。

2026-06-04 local backend `http://localhost:8080` passed 1/1 for the duplicate growth maintenance batch:
`growth-measurement-duplicate-boundary`。场景预置今日体重 7.4kg 后再次输入“今天体重还是7.4kg”，结构断言命中 `growthMeasurement/ask` + `missingFields[0]=duplicate`，并验证 `growthMeasurements` 1→1、`pendingEffects` 0→0。

2026-06-04 local backend `http://localhost:8080` passed 3/3 for the read-only/private-state batch:
`read-only-reminder-list-context`, `read-only-growth-trend-context`, `private-reminder-share-boundary`。第一次真实 L2 因 aiText 仍追问“这个提醒想定在什么时候”或承诺“我会同步”被新增 hard assertions 打红；修复后 3/3 PASS，且 seeded `reminders` / `growthMeasurements` 均未增长、`pendingEffects` 和 `memories` 均未增长。

2026-06-04 local backend `http://localhost:8080` passed 2/2 for the daily/weekly read-only summary batch:
`read-only-daily-summary-context`, `read-only-weekly-summary-context`。第一次真实 L2 因日报被误判成喂养缺字段、周报尾部追加“告诉我喝了多少 ml / 我再帮你记”被 hard assertions 打红；新增 `readOnlySummaryQuery` 后 2/2 PASS，且 seeded `careLogs` / `growthMeasurements` / `reminders` 均未增长、`pendingEffects` 和 `memories` 均未增长，judge 5/5。
