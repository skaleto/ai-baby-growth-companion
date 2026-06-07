# Records Entry And Growth Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Records page entry actions clearer by opening dedicated AI/manual drawers, move Growth into a peer Records tab, and add a basic growth curve.

**Architecture:** Keep the change frontend-only. Reuse existing care-log event persistence, existing AI composer handlers, and existing growth measurement state. Add a small Records drawer state in `App.tsx`, plus focused CSS and smoke/structure tests.

**Tech Stack:** React, TypeScript, existing local state/persistRecord helpers, Playwright frontend smoke, CSS in `mobile-app.css`.

---

### Task 1: Product Structure Test

**Files:**
- Modify: `scripts/test-product-simplification.mjs`

- [ ] Add assertions that Records tabs include `今日 / 成长 / 趋势 / 日历`, the main Records surface uses `AI 自动记录` and `手动记录`, and no inline `records-manual-form` appears in the main Records stack.
- [ ] Run `npm run test:product-simplification` and verify it fails before implementation.

### Task 2: Records IA And Drawer State

**Files:**
- Modify: `frontend/src/appOptions.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles/mobile-app.css`

- [ ] Extend `RecordView` with `growth` and add it to `RECORD_VIEWS`.
- [ ] Add `recordsEntryDrawer` state with values `null | "ai" | "manual"`.
- [ ] Change `AI 自动记录` and `手动记录` actions to open separate drawer panels.
- [ ] Move AI assistant inline content into the AI drawer.
- [ ] Move manual logging UI into the manual drawer.

### Task 3: Manual Record Types

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles/mobile-app.css`

- [ ] Add a manual type selector for `喂奶 / 睡眠 / 便便尿布 / 体温`.
- [ ] Make the manual drawer render only fields relevant to the selected type.
- [ ] Save manual records as care-log events through existing event stats and persistence.

### Task 4: Growth Tab And Curve

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles/mobile-app.css`

- [ ] Remove Growth card from the `今日` tab.
- [ ] Render a new `成长` tab with latest measurement stats, a measurement selector, an SVG growth curve, growth history, and existing `成长观察` entry.
- [ ] Keep existing `GrowthEntryView` overlay for add/edit/delete.

### Task 5: Verification

**Files:**
- Modify: `scripts/frontend-smoke.mjs`
- Modify: `harness/claude-progress.md`
- Modify: `harness/feature_list.json`

- [ ] Update smoke to open both Records drawers and visit the Growth tab.
- [ ] Run `npm run test:product-simplification`.
- [ ] Run `npm run verify:frontend`.
- [ ] Inspect at least one mobile screenshot.
- [ ] Run `git diff --check`.
- [ ] Record evidence in harness.
