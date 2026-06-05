# Recording Companion P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the P0 recording-companion loop from `docs/superpowers/specs/2026-06-02-recording-companion-improvements-design.md`: make `小宝今日观察` the single today-summary entry, add low-pressure stat cards, and upgrade chat record feedback.

**Architecture:** Keep P0 frontend-first. Add pure formatting/stat helpers in `frontend/src/utils/dailySummary.ts`, extend `DailySummaryView` props to receive existing app state, merge the separate Pro daily summary card into the observation card, and update chat effect cards without changing Agent extraction or backend DTOs.

**Tech Stack:** React 18, TypeScript, Vite, Playwright smoke/probe scripts, existing harness verification.

---

## File Map

- Modify `frontend/src/utils/dailySummary.ts`: care/growth stat helpers, data-point counter, gentle record-effect summary helpers.
- Modify `frontend/src/views/DailySummaryView.tsx`: `小宝今日观察` shell, empty/loading/stale states, stat cards, missing prompt actions, integrated generate button.
- Modify `frontend/src/App.tsx`: pass selected care/growth/date/caregiver props, remove duplicate `Pro 今日小结` primary card, add `查看今天` behavior to auto record feedback.
- Modify `frontend/src/styles/daily-summary.css`: observation header, stat card grid, gentle empty states, integrated controls.
- Modify `frontend/src/styles/mobile-app.css` only if App-level card styles need small adjustments.
- Modify `scripts/probe-daily-summary-view.mjs`: fixture with careLog/growth data and assertions/screenshots for P0 states.
- Create `scripts/test-daily-summary-utils.mjs`: lightweight RED/GREEN test script for pure helpers because the frontend currently has no unit-test runner.
- Update `harness/feature_list.json` and `harness/claude-progress.md`: record implementation status and evidence.

## Task 1: Pure Daily Observation Helpers

**Files:**
- Create: `scripts/test-daily-summary-utils.mjs`
- Modify: `frontend/src/utils/dailySummary.ts`

- [x] Step 1: Write failing helper tests for `buildCareStats`, `buildGrowthStats`, `countTodayDataPoints`, and `summarizeCareLogEffect`.
- [x] Step 2: Run `node scripts/test-daily-summary-utils.mjs` and verify it fails because helpers are missing.
- [x] Step 3: Implement minimal pure helpers in `frontend/src/utils/dailySummary.ts`.
- [x] Step 4: Run `node scripts/test-daily-summary-utils.mjs` and verify it passes.
- [x] Step 5: Run `npm run build`.

## Task 2: `小宝今日观察` UI Shell And Stat Cards

**Files:**
- Modify: `frontend/src/views/DailySummaryView.tsx`
- Modify: `frontend/src/styles/daily-summary.css`
- Modify: `frontend/src/App.tsx`

- [x] Step 1: Add props to `DailySummaryView` for `careLog`, `growthMeasurements`, `date`, `babyNickname`, `canCaregive`, `onGenerate`, `onOpenGrowth`, and missing prompt actions.
- [x] Step 2: Render `小宝今日观察` even when `summary` is null.
- [x] Step 3: Replace facts paragraph with 4 stat cards: 喂养、睡眠、护理、成长.
- [x] Step 4: Add state copy for empty, loading, fresh, stale, and read-only states.
- [x] Step 5: Move missing prompt rendering into the observation card with `补一下`, `今天不用记`, `以后少提醒这个`.
- [x] Step 6: Style for stable mobile dimensions and no high-pressure red/score visuals.
- [x] Step 7: Run `npm run build`.

## Task 3: Merge Duplicate `Pro 今日小结` Primary Entry

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles/mobile-app.css` if leftover spacing is affected.

- [x] Step 1: Remove or hide the duplicate `daily-summary-card` body from the records/today view.
- [x] Step 2: Preserve the existing `requestGenerateDailySummary`, missing prompt dismiss/mute, and read-only behavior through the new `DailySummaryView` props.
- [x] Step 3: Confirm the user-visible today page has only one summary primary entry.
- [x] Step 4: Run `npm run build`.

## Task 4: Chat Record Success Feedback

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles/mobile-app.css`
- Modify: `frontend/src/utils/dailySummary.ts` if effect-summary helper needs extension.

- [x] Step 1: Update `auto-effect-card` to title `已记好`, show structured summary and destination copy.
- [x] Step 2: Add `查看今天` button that switches to records/today.
- [x] Step 3: Keep `撤销` behavior unchanged.
- [x] Step 4: Keep pending cards as `待确认记录` with confirm/edit/ignore.
- [x] Step 5: Run `npm run build`.

## Task 5: Probe And Harness Verification

**Files:**
- Modify: `scripts/probe-daily-summary-view.mjs`
- Update: `harness/claude-progress.md`
- Update: `harness/feature_list.json`

- [x] Step 1: Extend probe fixture with careLog, growthMeasurements, stale and missing prompts.
- [x] Step 2: Run `node scripts/probe-daily-summary-view.mjs` and inspect artifacts under `.verification/daily-summary-probe`.
- [x] Step 3: Run `npm run verify:frontend`.
- [x] Step 4: Run `npm run test:agent-benchmark`.
- [x] Step 5: Run `git diff --check`.
- [x] Step 6: Record evidence and known risks in harness docs.
