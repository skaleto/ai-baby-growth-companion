## 1. Backend Expense Persistence Contract

- [x] 1.1 Add a structured expense persistence result for saved, duplicate, needs-input, and read-only candidates.
- [x] 1.2 Detect clear expense recording intent separately from read-only recognition intent.
- [x] 1.3 Auto-save complete recognized expenses when recording intent is present.
- [x] 1.4 Keep recognition-only requests read-only while preserving recognized summaries for follow-up recording.

## 2. Duplicate Protection And Idempotency

- [x] 2.1 Generate stable dedupe keys for recognized expenses from source attachments and normalized content.
- [x] 2.2 Skip duplicates during automatic expense persistence and report them in the persistence result.
- [x] 2.3 Make pending-effect confirmation idempotent so repeated confirms cannot insert duplicate expense rows.
- [x] 2.4 Prevent the same recognized result from being attached as multiple independently confirmable pending effects.

## 3. Category And Pending-Confirmation Rules

- [x] 3.1 Extend category inference for pregnancy clothing and baby feeding appliance terms.
- [x] 3.2 Ensure missing or uncertain category falls back to `other` and does not block persistence.
- [x] 3.3 Restrict pending expense confirmation to missing amount, date, purpose, unreadable image, or unclear relevance.

## 4. Final Reply And Frontend State

- [x] 4.1 Feed actual saved, duplicate, and needs-input facts into final expense reply generation or correction.
- [x] 4.2 Remove stale "needs more information" UI for records that were saved or deduplicated.
- [x] 4.3 Add frontend confirmation saving state to prevent repeated taps.
- [x] 4.4 Show saved/duplicate/needs-input summaries without adding chat-level undo.

## 5. Verification And Release Evidence

- [x] 5.1 Add backend tests for auto-save, read-only recognition, duplicate skipping, pending confirmation idempotency, and category inference.
- [x] 5.2 Add or update Agent benchmark cases for the confirmed expense recording interaction contract.
- [x] 5.3 Run OpenSpec validation, backend tests, Agent benchmark, frontend verification, and release checks required by the harness.
- [x] 5.4 Update harness evidence and leave existing production duplicate rows untouched.
