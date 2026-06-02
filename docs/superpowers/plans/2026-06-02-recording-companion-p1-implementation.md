# Recording Companion P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the P1 recording-companion features from `docs/superpowers/specs/2026-06-02-recording-companion-improvements-design.md`: data-linked caregiver companion line, copyable handoff summary, AI explanation entry, and Agent caregiver-support safety boundaries.

**Architecture:** Keep the daily observation P1 UI deterministic and frontend-first. Extend `frontend/src/utils/dailySummary.ts` with pure helpers for caregiver note and handoff copy, render them in `DailySummaryView`, and update `AgentPrompts` with non-diagnostic fatigue/self-blame/high-risk guidance guarded by an Agent benchmark.

**Tech Stack:** React 18, TypeScript, Vite, Playwright probe/smoke, Java/JUnit Agent benchmark, existing Aliyun ECS and OTA scripts.

---

## File Map

- Modify `frontend/src/utils/dailySummary.ts`: add `buildCaregiverCompanionLine` and `buildHandoffSummary`.
- Modify `scripts/test-daily-summary-utils.mjs`: RED/GREEN tests for P1 helpers and banned words.
- Modify `frontend/src/views/DailySummaryView.tsx`: render caregiver line, AI explanation details, and `今日交接` summary.
- Modify `frontend/src/App.tsx`: pass reminders/pending counts and copy handler.
- Modify `frontend/src/styles/daily-summary.css`: style P1 note, explanation, and handoff section.
- Modify `scripts/probe-daily-summary-view.mjs`: assert P1 UI appears in daily observation screenshots.
- Modify `backend/src/main/java/com/xiaobao/babycompanion/agent/AgentPrompts.java`: add caregiver fatigue/self-blame and high-risk boundary instructions.
- Modify `backend/src/test/java/com/xiaobao/babycompanion/agent/AgentBenchmarkTests.java`: benchmark prompt includes P1 boundaries.
- Update `harness/claude-progress.md` and `harness/feature_list.json`: record verification and deployment evidence.

## Task 1: P1 Pure Helpers

**Files:**
- Modify: `scripts/test-daily-summary-utils.mjs`
- Modify: `frontend/src/utils/dailySummary.ts`

- [x] Step 1: Add failing tests for `buildCaregiverCompanionLine` and `buildHandoffSummary`.
- [x] Step 2: Run `node scripts/test-daily-summary-utils.mjs`; expected failure is missing helper export.
- [x] Step 3: Implement helper functions using only real care/growth/reminder data.
- [x] Step 4: Run `node scripts/test-daily-summary-utils.mjs`; expected pass.

## Task 2: P1 Daily Observation UI

**Files:**
- Modify: `frontend/src/views/DailySummaryView.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles/daily-summary.css`

- [x] Step 1: Add props for reminders, pending effect count, and copy handoff callback.
- [x] Step 2: Render `给照护人的话` inside `小宝今日观察`.
- [x] Step 3: Render `这些观察怎么来的` as an inline details disclosure.
- [x] Step 4: Render `今日交接` with grouped summary and `复制交接`.
- [x] Step 5: Run `npm run build`.

## Task 3: Agent Boundary Benchmark

**Files:**
- Modify: `backend/src/main/java/com/xiaobao/babycompanion/agent/AgentPrompts.java`
- Modify: `backend/src/test/java/com/xiaobao/babycompanion/agent/AgentBenchmarkTests.java`

- [x] Step 1: Add failing benchmark that expects caregiver-support and high-risk safety boundary text in `AGENT_SYSTEM_PROMPT`.
- [x] Step 2: Run `npm run test:agent-benchmark`; expected failure is missing prompt boundary text.
- [x] Step 3: Add the prompt boundary instructions.
- [x] Step 4: Run `npm run test:agent-benchmark`; expected pass.

## Task 4: Probe, Full Verification, Git, ECS, OTA

**Files:**
- Modify: `scripts/probe-daily-summary-view.mjs`
- Update: `harness/claude-progress.md`
- Update: `harness/feature_list.json`

- [x] Step 1: Add probe assertions for `给照护人的话`, `今日交接`, and `这些观察怎么来的`.
- [x] Step 2: Run `node scripts/probe-daily-summary-view.mjs`.
- [x] Step 3: Run `npm run verify:frontend`.
- [x] Step 4: Run `npm run test:agent-benchmark`.
- [x] Step 5: Run `git diff --check`.
- [x] Step 6: Build OTA with `MOBILE_UPDATE_PUBLIC_BASE_URL=http://120.55.188.242:8300 MOBILE_UPDATE_MESSAGE='小宝今日观察升级：陪伴一句话、今日交接、记录反馈' npm run build:mobile:update`.
- [x] Step 7: Commit and push the full current worktree to `origin/main`.
- [x] Step 8: Deploy code plus OTA to ECS with `SYNC_DATA=0 SYNC_MOBILE_UPDATES=1 ECS_HOST=120.55.188.242 npm run deploy:aliyun`.
- [x] Step 9: Verify `http://120.55.188.242:8300/api/health` and `/api/mobile-updates/check`.

## Completion Evidence

- `node scripts/test-daily-summary-utils.mjs` passed.
- `node scripts/probe-daily-summary-view.mjs` passed and generated first-screen plus handoff screenshots.
- `npm run verify:frontend` passed after fixing smoke fixture date drift for future reminders.
- `npm run test:agent-benchmark` passed with 26 tests.
- OTA `0.1.0-20260602232444` built and deployed to `120.55.188.242:8300`; remote bundle checksum matched `087927a33177c969182f89e5c551769b2dd75a11ec68d839147e4d415b4460b2`.
