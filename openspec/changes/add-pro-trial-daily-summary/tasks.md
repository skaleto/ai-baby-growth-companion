## 1. Database and Persistence

- [x] 1.1 Add SQLite migration for `pro_trial_application`.
- [x] 1.2 Add SQLite migration for `pro_trial_entitlement`.
- [x] 1.3 Add SQLite migration for `ai_usage_log`.
- [x] 1.4 Add SQLite migration for `daily_summary`.
- [x] 1.5 Add storage for account-level daily summary reminder settings.
- [x] 1.6 Add storage for family-level critical record type settings or a documented default fallback.
- [x] 1.7 Add repository/service methods for Pro application, entitlement, AI usage, daily summary, and summary settings.

## 2. Backend Pro Trial APIs and State

- [x] 2.1 Add API or state collection support for submitting a Pro trial application.
- [x] 2.2 Make application submission idempotent for the same family/user.
- [x] 2.3 Expose current family Pro status in app state.
- [x] 2.4 Expose current user's Pro application status in app state.
- [x] 2.5 Expose daily summary reminder settings in app state.
- [x] 2.6 Enforce that all family members can read Pro status.
- [x] 2.7 Enforce that only caregivers can trigger Pro generation actions.

## 3. AI Usage Logging

- [x] 3.1 Identify all backend model invocation points that should record usage.
- [x] 3.2 Add a common AI usage logging service.
- [x] 3.3 Capture provider/model/feature/inputType/requestId/familyId/userId.
- [x] 3.4 Capture input/output/total tokens when provider response includes usage.
- [x] 3.5 Record failed calls with success=false and error_code.
- [x] 3.6 Add weekly/monthly family aggregation query or service.
- [x] 3.7 Add soft warning logs for threshold exceedance; leave hard enforcement behind a feature flag.

## 4. Daily Summary Backend

- [x] 4.1 Add daily summary DTO/domain type.
- [x] 4.2 Build summary context from family-shared data only: profile, care logs, growth events, saved album items, expenses.
- [x] 4.3 Exclude private chat, private reminders, private pending effects, memories, and conversation summaries.
- [x] 4.4 Implement missing item detection for feeding and sleep absolute absence.
- [x] 4.5 Implement current-account missing item detection for reminders, pending effects, and album confirmations.
- [x] 4.6 Generate fact + gentle observation summary without diagnosis or strong medical advice.
- [x] 4.7 Persist one summary per family/date and overwrite latest version on regeneration.
- [x] 4.8 Compute and store a source fingerprint so the UI can detect stale summaries after new records.
- [x] 4.9 Return canonical persisted summary after generation.

## 5. Frontend Pro Trial Entry Points

- [x] 5.1 Add Pro trial card/component with concise feature explanation.
- [x] 5.2 Add My page Pro trial status and application button.
- [x] 5.3 Add record Today page Pro daily summary area.
- [x] 5.4 Add image/video AI trigger Pro card for non-Pro families without calling high-cost model.
- [x] 5.5 Show pending application state after submission.
- [x] 5.6 Show enabled Pro state to all family members.

## 6. Frontend Daily Summary and Missing Items

- [x] 6.1 Show existing daily summary in record Today page.
- [x] 6.2 Show caregiver-only generate/regenerate action.
- [x] 6.3 Hide generation action for read-only members.
- [x] 6.4 Show stale summary indicator when source fingerprint changed.
- [x] 6.5 Render missing item cards with gentle wording.
- [x] 6.6 Implement `补一下`, `今天不用记`, and `以后别提醒这个` entry points.
- [x] 6.7 Ensure daily summary card does not render as a timeline fact event.

## 7. Daily Reminder

- [x] 7.1 Add account-level setting UI for daily summary reminder enable/disable.
- [x] 7.2 Add account-level reminder time UI with default `21:30`.
- [x] 7.3 Schedule a local notification that opens the record Today page.
- [x] 7.4 Ensure notification only asks the user to confirm generation and does not trigger background AI generation.
- [x] 7.5 Ensure settings and reminder state are persisted per account.

## 8. Agent and Benchmark Updates

- [x] 8.1 Add/adjust prompt contract for daily summary: facts + gentle observations, no diagnosis.
- [x] 8.2 Add benchmark for missing feeding/sleep as gentle observation.
- [x] 8.3 Add benchmark to prevent private chat/reminder content from shared summary.
- [x] 8.4 Add benchmark for no technical fields or provider/token terms in user-facing copy.
- [x] 8.5 Run `npm run test:agent-benchmark`.

## 9. Verification

- [x] 9.1 Run backend tests covering application, entitlement, summary permissions, private-data exclusion, and usage logging.
- [x] 9.2 Run `npm run build`.
- [x] 9.3 Run `npm run verify:frontend`.
- [x] 9.4 If notification/native code changes, run `npm run mobile:sync`.
- [x] 9.5 If native code changes or mobile sync modifies native projects, run `npm run build:android:debug`.
- [x] 9.6 If iOS native path is touched and local Xcode supports it, run `npm run build:ios:debug`.
- [x] 9.7 Document blocked checks and real-device residual risks.

## 10. Documentation and Handoff

- [x] 10.1 Update `docs/commercialization/` if implementation changes product decisions.
- [x] 10.2 Update `harness/feature_list.json` with verification evidence.
- [x] 10.3 Update `harness/claude-progress.md` with completed state and known risks.
- [x] 10.4 Keep user-facing copy free of token/model/provider/technical field names.
- [x] 10.5 Commit and push after implementation and verification if requested.
