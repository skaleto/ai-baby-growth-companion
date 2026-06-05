## Context

The current expense flow has three mismatches with the desired user experience.

First, the Agent recognizes expense screenshots as `pendingEffect` records even when the user explicitly asked to record the expenses and all core fields are present. The user then has to find and confirm a card in the chat message, which makes "record this" feel unfinished.

Second, pending effects are message-scoped and confirmation is not idempotent enough. The same recognized expense payload can appear on multiple messages, or be confirmed more than once, and the backend can insert duplicates.

Third, final user copy is not tied to persistence facts. A reply can still show "needs more information" after records are saved, or ask for an amount that has already been recognized.

Existing constraints:
- The app is mobile-first React + Capacitor with a Spring backend and SQLite persistence.
- Expense recognition already runs through the executable `expense-recognition` skill and records agent/skill traces.
- Ledger records are family-scoped.
- Existing production duplicate rows must not be deleted by this change.

## Goals / Non-Goals

**Goals:**
- Make expense recording intent-driven: explicit record intent plus complete core fields saves to the ledger automatically.
- Keep read-only recognition requests read-only.
- Use pending confirmation only for incomplete or risky items.
- Prevent duplicate ledger entries across double taps, repeated messages, repeated pending effects, and retried image recognition.
- Keep model-authored final replies, but require them to reflect actual persistence results.
- Improve coarse category inference for common pregnancy and baby expenses without blocking save.
- Make chat UI states match the real state after auto-save or confirmation.

**Non-Goals:**
- Deleting existing duplicate production ledger rows.
- Adding fine-grained expense categories beyond the existing coarse taxonomy.
- Adding chat-level undo for auto-saved expenses; users edit or delete in ledger details.
- Replacing the executable expense-recognition skill architecture.

## Decisions

### Decision: Use a structured persistence result between recognition and final reply

Expense recognition should produce structured candidates. A deterministic persistence step then classifies candidates into:
- `saved`: newly written ledger items.
- `duplicate`: items skipped because they already exist.
- `needsInput`: items missing core facts or requiring user judgment.
- `readOnly`: recognized items shown without persistence because the user did not ask to record.

The final response should be generated or corrected using these facts. This keeps the model's natural language role while preventing the user from seeing "saved" when the backend failed or "needs confirmation" when the backend already saved.

Alternative considered: Continue returning model text first and patch it afterward. This was rejected because it produced misleading copy and scattered the source of truth.

### Decision: Auto-save complete expenses only with clear recording intent

The runtime should treat requests such as "记下来", "记到账本", "记录这些花费", and "把上面的花费再记录一遍" as recording intent. Requests such as "看看这些是什么", "识别一下", or "这些花了多少钱" are recognition-only unless they follow a previous recognized draft and explicitly ask to record.

Alternative considered: Auto-save any complete receipt screenshot. This was rejected because users may want analysis without modifying the ledger.

### Decision: Deduplicate in the backend, not just in the UI

The backend should derive stable keys for recognized expenses using source information and content:
- Prefer a `sourceRunId` or `sourceExpenseKey` generated from the recognized attachment ids and normalized candidate fields.
- Fall back to normalized `familyId + date + amount + title + merchant + attachmentIds`.

Duplicate checks must run during pending-effect confirmation and automatic effect persistence. Frontend disabled states improve UX but are not sufficient.

Alternative considered: Only disable the confirm button after click. This was rejected because duplicate requests can arrive from different messages or sessions.

### Decision: Keep pending effects only for incomplete or risky records

Pending effects are appropriate when amount, date, purpose, or baby/pregnancy relevance is missing or uncertain. Category, merchant, brand, spec, and note are not confirmation blockers. Unknown category falls back to `other`.

Alternative considered: Keep all AI-generated expenses pending for safety. This was rejected because it creates repeated manual confirmations for a task the user explicitly requested.

### Decision: Keep coarse category taxonomy and improve inference

The existing category enum remains the user-facing taxonomy. Recognition and backend fallback should map common terms:
- 月子鞋、月子服、宝宝衣物 -> `clothing`
- 摇奶器、恒温壶、奶瓶、奶瓶刷、消毒柜、温奶器、吸奶器 -> `daily`
- 奶粉 -> `formula`
- 纸尿裤、拉拉裤 -> `diaper`
- 药、挂号、医院、检查、疫苗 -> `health` or `vaccine`

Alternative considered: Add new mother-and-baby appliance categories. This was deferred to avoid a larger ledger taxonomy migration.

## Risks / Trade-offs

- [Risk] False-positive auto-save from an ambiguous user request -> Mitigation: require clear recording intent and complete core fields.
- [Risk] Duplicate detection collapses two legitimate identical purchases -> Mitigation: include attachment/source keys when present, and only silently skip high-confidence duplicates.
- [Risk] Final model reply contradicts persistence facts -> Mitigation: inject persistence facts into reply generation and keep deterministic fact-correction as a final guard.
- [Risk] Users may miss that an item was skipped as duplicate -> Mitigation: include duplicate counts and concise duplicate summaries in final copy.
- [Risk] Existing clients may still render pending cards from older messages -> Mitigation: new confirmations are idempotent, and saved/duplicate results should remove or mark pending records in the returned app snapshot.

## Migration Plan

1. Ship backend persistence-result and dedupe logic behind the existing Agent endpoints.
2. Ship frontend UI state updates for auto-save result cards and confirm-button disabled state.
3. Add regression coverage for auto-save, read-only recognition, duplicate skipping, pending confirmation idempotency, and category inference.
4. Publish a new OTA bundle because chat UI behavior changes.
5. Do not mutate existing production duplicate rows.

Rollback is a code rollback plus OTA rollback to the prior bundle. Since this change does not run a production data cleanup, rollback does not require database restoration.

## Open Questions

None. The interaction contract was confirmed with the user before implementation.
