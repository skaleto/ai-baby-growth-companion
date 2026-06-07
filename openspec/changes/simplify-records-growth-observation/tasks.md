## 1. Records Today Hierarchy

- [x] 1.1 Move the Records today summary and today timeline above low-frequency growth observation content.
- [x] 1.2 Keep quick logging and manual logging available before the summary/timeline review surface.
- [x] 1.3 Confirm pending AI effects, if present, remain visible in the Records context and do not require opening a Chat tab.

## 2. Growth And Observation Entry

- [x] 2.1 Remove the standalone `发育里程碑` card from the Records today main stack.
- [x] 2.2 Add a compact `成长观察` row or footer inside the Growth card that opens the existing milestone/detail surface.
- [x] 2.3 Remove score-like milestone progress copy from the main Records surface, including `已记录 X/Y` style wording.
- [x] 2.4 Keep latest height, weight, and head circumference values visible in the Growth area.
- [x] 2.5 Ensure the no-growth-data empty state remains optional and low-pressure.

## 3. Copy And Low-Anxiety Behavior

- [x] 3.1 Use `成长观察` on the main Records surface and avoid overdue, missing, abnormal, ranking, or peer-comparison wording.
- [x] 3.2 Preserve existing milestone records and the existing detail surface for view/edit/achievement actions.
- [x] 3.3 Update any Records-surface labels that still imply milestones are a required daily task.

## 4. Frontend Verification

- [x] 4.1 Update or add frontend smoke coverage for the Records default view and growth observation entry.
- [x] 4.2 Run `npm run test:product-simplification`.
- [x] 4.3 Run `npm run verify:frontend`.
- [x] 4.4 Capture or reference mobile screenshots for the Records default view after the hierarchy change.
- [x] 4.5 Run `git diff --check`.

## 5. Harness Handoff

- [x] 5.1 Update `harness/feature_list.json` or `harness/claude-progress.md` with implementation evidence if the change is implemented.
- [x] 5.2 Summarize verification commands, covered viewports, and residual risks in the final handoff.
