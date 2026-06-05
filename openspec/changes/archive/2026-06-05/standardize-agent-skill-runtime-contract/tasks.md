## 1. Skill Runtime Contract

- [x] 1.1 Add planner output support for executable `skillRequests`.
- [x] 1.2 Normalize and allowlist executable skill requests in `AgentPlanner` and `SkillRouter`.
- [x] 1.3 Ensure `AgentRuntime` executes planner-selected skill requests before final composition.
- [x] 1.4 Preserve deterministic fallback only as backend runtime safety, not as frontend natural-language routing.

## 2. Previous Media Reference Handling

- [x] 2.1 Remove frontend regex-based previous-expense attachment forwarding.
- [x] 2.2 Send recent message attachment metadata as context instead of duplicating prior attachment payloads.
- [x] 2.3 Add backend attachment hydration for selected executable skills using attachment id and family boundary.
- [x] 2.4 Limit hydrated visual inputs to the existing Agent visual attachment cap.

## 3. Expense Recognition Runtime Path

- [x] 3.1 Route current and previous-image expense recording requests to `expense-recognition`.
- [x] 3.2 Ensure expense skill execution does not trigger web search for actual payment recognition.
- [x] 3.3 Keep category inference non-blocking for pregnancy clothing and baby feeding appliance terms.
- [x] 3.4 Ensure incomplete skill output becomes a skill-sourced clarification instead of model-generated ledger candidates.

## 4. Documentation And Verification

- [x] 4.1 Update Agent design docs with the planner-skill-runtime-effect-persistence contract.
- [x] 4.2 Add backend tests for planner-selected skill requests, router execution, previous attachment hydration, and category-only clarification.
- [x] 4.3 Add Agent benchmark coverage for previous-image retry without frontend forwarding and category-only non-blocking behavior.
- [x] 4.4 Run OpenSpec validation, targeted backend tests, Agent benchmark, frontend verification, and deployment checks.
