# Module-Native AI And Full Tool-First Migration Plan

> **For agentic workers:** implement task-by-task, but do not ship a partial migration. The product cutover is all-at-once for the currently supported Records/Ledger AI write paths.

**Goal:** Implement the 2026-06-06 direction with the 2026-06-07 user override: Records-first app shell, module-native AI entry points, Album day timeline, My-based reminders, and a full backend Agent action-tool migration for Records/Ledger writes.

**Architecture:** Frontend remains the React/Capacitor monolith. Backend replaces the old `RecordSignalExtractor + EffectPolicy` write path with Agent Runtime controlled function tools. The old write path is deleted or fully disconnected from production runtime, not kept as fallback, shadow oracle, or compatibility layer.

**User Override On 2026-06-07:** production is only a few controlled family users. Prefer a clean architecture cutover over compatibility complexity. Migrate the retained Records/Ledger AI write capabilities together; do not leave half of them on the old path.

**Implementation Status On 2026-06-07:** Agent tool-first cutover is implemented and verified for retained Records/Ledger AI writes. Product shell/IA tasks such as removing the independent chat tab and making records the default mobile home remain separate follow-up work unless already handled in another branch.

---

## Non-Negotiable Rules

- No ecommerce, expert/knowledge-pay, open community, or AI reminder/todo tools.
- No production fallback to `RecordSignalExtractor`, `EffectPolicy`, or frontend reconstruction from transient `effectDecisions`.
- No "feeding first" release. Feeding, core care records, growth measurements, and ledger text expenses must cut over together if they are still user-facing AI write capabilities.
- If a former AI write capability is not reimplemented as an action tool, remove it from the AI-supported capability manifest and make the assistant say it is not supported through AI yet.
- Final assistant text must be grounded in actual action results. It cannot say "已记录", "已保存", "已整理成待确认" unless a tool returned `applied` or `pending_created`.
- `pending` means backend-persisted app state (`pending_effect`) visible through `/api/app/state`; it is not a model-only draft or frontend-only card.
- Manual record/ledger UI must continue to work even if Agent tools fail.
- Preserve production/local data paths: `backend/data/`, `backend/backend/data/`, `backups/`, `.env*`, and `scripts/cloud-feature-e2e.env.local`.

## Current Inputs

- Product IA spec: `docs/superpowers/specs/2026-06-06-module-native-ai-records-album-ledger-spec.md`
- Previous simplification spec: `docs/superpowers/specs/2026-06-06-product-simplification-records-trust-spec.md`
- Agent tool-first spec: `docs/superpowers/specs/2026-06-06-agent-tool-first-recording-architecture-spec.md`
- Current compressed state: `harness/session-handoff.md`
- Current feature inventory: `docs/feature-inventory.md`

## Target Supported AI Write Tools

Implement all tools below in the same migration batch, or explicitly remove the corresponding AI capability from prompts/manifests.

Records:

- `record_feeding_event`: applied care log write.
- `record_sleep_event`: applied care log write for sleep start/end/duration when sufficient.
- `record_diaper_event`: applied care log write for diaper/poop/pee when sufficient.
- `record_temperature_event`: applied care log write or pending health observation when values need confirmation.
- `create_growth_measurement_pending`: persisted pending effect for height/weight/head circumference.
- `create_milestone_pending`: persisted pending effect for milestone/growth note.

Ledger:

- `create_expense_pending`: persisted pending expense draft.

Out of scope for this migration:

- AI reminders/todos.
- Expert advice, paid knowledge content, ecommerce, open community.
- User-facing model/mode selection.
- Album AI center. Album remains day timeline; media auto-save must be handled outside the old `EffectPolicy` path or disabled from AI claims.

## Backend File Structure

Create:

- `backend/src/main/java/com/xiaobao/babycompanion/agent/action/AgentActionTool.java`
- `backend/src/main/java/com/xiaobao/babycompanion/agent/action/AgentActionCall.java`
- `backend/src/main/java/com/xiaobao/babycompanion/agent/action/AgentActionContext.java`
- `backend/src/main/java/com/xiaobao/babycompanion/agent/action/AgentActionResult.java`
- `backend/src/main/java/com/xiaobao/babycompanion/agent/action/AgentActionRegistry.java`
- `backend/src/main/java/com/xiaobao/babycompanion/agent/action/AgentActionExecutor.java`
- `backend/src/main/java/com/xiaobao/babycompanion/agent/action/AgentActionValidator.java`
- `backend/src/main/java/com/xiaobao/babycompanion/agent/action/AgentActionResponseGuard.java`
- `backend/src/main/java/com/xiaobao/babycompanion/service/AgentMutationService.java`

Create tools:

- `RecordFeedingEventTool.java`
- `RecordSleepEventTool.java`
- `RecordDiaperEventTool.java`
- `RecordTemperatureEventTool.java`
- `CreateGrowthMeasurementPendingTool.java`
- `CreateMilestonePendingTool.java`
- `CreateExpensePendingTool.java`

Modify:

- `AgentRuntime.java`: register and execute action tools; remove old write chain.
- `AgentPrompts.java`: remove final JSON/effect-decision write authority and old capability promises.
- `AgentPlanner.java`: expose tool-capability context, not old extractor-driven effects.
- `AgentController.java`: include action results/app-state deltas as needed.
- `AppStateService.java`: expose backend-internal mutation helpers used by `AgentMutationService`.
- `capability-manifest.json`: remove unsupported old effect capabilities and list action-tool-backed capabilities only.

Delete or disconnect:

- `RecordSignalExtractor` from production runtime.
- `EffectPolicy` from production runtime.
- Old tests that assert extractor/effect-policy write behavior, after replacement tests exist.

## Frontend File Structure

Modify:

- `frontend/src/appOptions.ts`: target tabs and remove user-facing model/mode assumptions.
- `frontend/src/App.tsx`: Records default home, no independent Chat bottom tab, Records composer, app-state-backed pending cards.
- `frontend/src/appStateApi.ts` and `frontend/src/appStateDomain.ts`: persisted `pendingEffects` contract.
- `frontend/src/styles/app-base.css`, `frontend/src/styles/mobile-app.css`, `frontend/src/styles/warm-theme.css`: Records composer, bottom nav, Album day timeline, My reminder entry.
- `scripts/frontend-smoke.mjs`, `scripts/test-product-simplification.mjs`, `scripts/test-chat-quick-actions.mjs`: update assertions to Records-first behavior.

## Task 1: Freeze Baseline

- [ ] Run baseline:

```bash
bash harness/init.sh
npm run test:agent-l2:unit
npm run verify:frontend
```

Expected: all pass before migration edits.

- [ ] Confirm no protected data paths are staged or modified:

```bash
git status --short -- backend/data backend/backend/data backups .env scripts/cloud-feature-e2e.env.local
```

Expected: no output.

## Task 2: Define Action Result Contract

- [ ] Add failing tests for `AgentActionResult`, validator, and response guard.

Minimum result shape:

```java
public record AgentActionResult(
        String status,
        String toolName,
        String mutationType,
        List<String> recordIds,
        String pendingEffectId,
        Map<String, Object> facts,
        String userMessage,
        List<String> missingFields,
        List<String> warnings
) {}
```

Allowed statuses:

- `applied`
- `pending_created`
- `needs_input`
- `unsupported`
- `rejected`
- `failed`

- [ ] Add `AgentActionResponseGuard` tests:
  - "已记录" without `applied` is blocked/rephrased.
  - "待确认" without `pending_created` is blocked/rephrased.
  - `needs_input` forces the missing-field question.
  - `unsupported` gives manual-entry guidance.

## Task 3: Implement Mutation Service

- [ ] Add tests for backend-internal writes:
  - append care log patch for feeding/sleep/diaper/temperature.
  - create persisted pending growth measurement.
  - create persisted pending milestone.
  - create persisted pending expense.
  - idempotency key prevents duplicate writes.

- [ ] Implement `AgentMutationService` using explicit `familyId` and `userId` from `AgentActionContext`.

Pending effect source metadata:

```json
{
  "source": {
    "kind": "agent_action",
    "traceId": "...",
    "toolCallId": "...",
    "toolName": "...",
    "idempotencyKey": "..."
  }
}
```

- [ ] Add stable ids for pending effects:

```text
pending-effect:<toolName>:<familyId>:<idempotencyKey>
```

## Task 4: Implement All Records/Ledger Tools

- [ ] Add tool schema and execution tests for all target tools:

```text
record_feeding_event
record_sleep_event
record_diaper_event
record_temperature_event
create_growth_measurement_pending
create_milestone_pending
create_expense_pending
```

- [ ] Validation rules:
  - clear complete care/expense facts can write or create pending.
  - ambiguous milk type asks follow-up.
  - unknown relative date asks follow-up.
  - impossible growth/temperature values ask follow-up or create pending with warning, never applied silently.
  - reminder/todo requests return `unsupported` and do not mutate.
  - unsupported old write domains do not fall back to old extractors.

- [ ] Implement all tools in one migration batch.

## Task 5: Wire Agent Runtime To Tools And Delete Old Write Chain

- [ ] Runtime tests:
  - model tool call writes care log/pending effect and final reply matches result.
  - tool failure prevents success wording.
  - reminder/todo has no mutation.
  - old `RecordSignalExtractor + EffectPolicy` path is not invoked for records/ledger.

- [ ] Runtime implementation:
  - register action tools with the model as controlled function tools.
  - execute returned tool calls through `AgentActionExecutor`.
  - pass action results to final composer.
  - run `AgentActionResponseGuard` after final text generation.
  - remove `effectDecisions` as a write authority.

- [ ] Delete/disconnect old chain:
  - remove `RecordSignalExtractor` calls from `AgentRuntime`.
  - remove `EffectPolicy.decide(...)` from Agent write flow.
  - remove capability-manifest entries that imply old effect writes.
  - delete old tests once replacement tests cover the same boundary.

No production fallback or shadow path remains.

## Task 6: Frontend App-State Pending Contract

- [ ] Add/verify app-state response support:

```ts
type PendingEffectView = {
  id: string;
  domain: "growth_measurement" | "milestone" | "expense" | "health_observation" | string;
  status: "pending" | "applied" | "dismissed";
  source: {
    kind: "agent_action";
    traceId: string;
    toolCallId: string;
    toolName: string;
    idempotencyKey: string;
  };
  payload: unknown;
};
```

- [ ] Frontend confirmation cards read persisted `pendingEffects`.
- [ ] Frontend does not reconstruct cards from model `effectDecisions`.
- [ ] Frontend deduplicates by stable pending effect id.
- [ ] Confirm/dismiss flows update backend-persisted app state.

## Task 7: Product Shell Cutover

- [ ] Make `记录` the default mobile home.
- [ ] Remove independent `聊天` and `提醒` bottom tabs from target navigation.
- [ ] Render Records-native composer.
- [ ] Keep reminders reachable from `我的`, but do not expose AI reminder tools.
- [ ] Render Album by day.
- [ ] Keep Ledger manual path and pending expense confirmation path.

## Task 8: Benchmarks

- [ ] Rewrite agent benchmark from old effect semantics to action-result semantics.
- [ ] Add 40-60 Chinese replay cases covering:
  - feeding;
  - sleep;
  - diaper;
  - temperature/health observation;
  - growth measurement;
  - milestone/growth note;
  - expense;
  - unsupported reminder/todo;
  - read-only summaries;
  - ambiguous cases.

- [ ] Required assertions:
  - no false "已记录/待确认";
  - no mutation on unsupported reminder/todo;
  - no old effect-policy write output;
  - complete supported cases mutate backend app state;
  - ambiguous cases ask follow-up and do not write.

## Task 9: Verification Gate

Run before handoff:

```bash
git diff --check
node scripts/test-agent-product-coverage-index.mjs
node scripts/test-app-function-coverage-index.mjs
npm run test:agent-benchmark
npm run test:agent-l2:unit
npm run verify:frontend
mvn -f backend/pom.xml test
```

If native-sensitive files changed:

```bash
npm run mobile:sync
npm run build:ios:debug
npm run build:android:debug
```

Do not publish ECS or OTA unless the user explicitly asks after reviewing the implementation result.

## Definition Of Done

- All retained Records/Ledger AI write capabilities use action tools.
- `RecordSignalExtractor + EffectPolicy` is not in the Agent production write path.
- Unsupported removed capabilities are removed from prompts/manifests and return safe non-mutation guidance.
- Frontend pending cards come from persisted app state.
- Final text is mechanically grounded in action results.
- Agent benchmark and frontend verification pass.
