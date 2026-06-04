# Agent/Product Benchmark Coverage Index

Generated/maintained alongside `scripts/l2-benchmark/product-coverage-index.mjs`.

This index answers a narrow question: for every product feature tracked in `harness/feature_list.json`, what proves it is covered? Some features belong in real Agent L2 scenarios; others are better proven by frontend smoke, backend controller tests, native builds, or cloud probes.

For detailed scenario-level coverage, use `docs/app-function-coverage-index.md`. That lower-level index maps every table row in `docs/feature-inventory.md` to an executable gate, a static/native contract, or a visible known gap. It now includes an explicit `成长数据维护` domain so growth measurements do not hide inside the broader Records/Agent rows.

| Feature | Status | Primary coverage | Remaining gap / next action |
|---|---|---|---|
| `harness-001` | covered by non-agent gate | `bash harness/init.sh` verifies repo state, whitespace, frontend build, and Agent benchmark. | Keep this as the restart contract for future sessions. |
| `agent-001` | covered | `npm run test:agent-benchmark` plus L2 scenarios for records, reminders, ledger, growth, memory, Q&A, read-only summaries, privacy boundary, album save/ignore, and safety. | Add new L2 scenarios whenever a new user-facing Agent behavior lands. |
| `agent-002` | covered | L0/L1 skill tests cover expense-recognition batching, previous-image hydration, duplicate handling, and persistence fallbacks; L2 `expense-record` covers text ledger draft. | Add real image-expense L2 once deterministic receipt fixtures/upload setup is stable. |
| `frontend-001` | covered by non-agent gate | `npm run verify:frontend`, `docs/frontend-verification.md`, and Playwright screenshots cover mobile layout and interaction smoke. | UI changes need a fresh `verify:frontend` run; build alone is not evidence. |
| `recording-companion-p0` | covered by non-agent gate | `scripts/test-daily-summary-utils.mjs`, `scripts/probe-daily-summary-view.mjs`, frontend smoke, L2 `daily-observation-context`, and L2 `read-only-daily-summary-context`. | Keep UI probe and L2 read-only summary paired when daily observation changes. |
| `recording-companion-p1` | covered by non-agent gate | Daily-summary helper/probe tests plus L2 `caregiver-fatigue-context` and `read-only-weekly-summary-context`. | This remains non-diagnostic support; riskier mental-health copy needs dedicated benchmark cases. |
| `cloud-001` | covered by non-agent gate | `SYNC_DATA=0` deploy discipline, `/api/health`, OTA probes, and `npm run test:cloud-e2e` for behavior-specific live checks. | Health alone does not prove Agent, persistence, media, or cross-user behavior. |
| `mobile-001` | known gap | `scripts/native-capability-audit.mjs` and `docs/native-capability-benchmark.md` track `asr-voice-input`, `local-notifications`, `full-screen-ringing`, `haptics`, `native-media-picker`, `ota-updater`, and `safe-area-keyboard` static evidence. | Add real device probes for input/delivery/apply behavior; browser/L2 can only hold the contract, not prove OS behavior. |
| `growth-001` | covered | Frontend growth smoke, AppState growth maintenance tests, and L2 growth maintenance cases: complete pending draft, ambiguous unit ask, out-of-range ask, chat update/delete boundary, duplicate no-write, and read-only trend query. `docs/app-function-coverage-index.md` further splits growth entry/latest values, manual add/edit/delete, AI pending confirmation, boundaries, and trend read-only query. | Future percentiles/reference curves need separate tests; they are intentionally outside MVP. |
| `shared-records-001` | covered by non-agent gate | Backend state tests, `npm run test:cloud-e2e`, L2 private sharing boundary, and L2 album mutation shape. | Contributor labels and attachment previews remain frontend/cloud gates, not L2-only. |
| `commercialization-001` | covered by non-agent gate | ProTrial backend tests, frontend smoke, Agent benchmark, and native gates when notifications are touched. | Entitlement or role changes need cloud/account-level probes. |

## Agent L2 Representative Set

The coverage index currently references these representative runnable scenarios:

- Records: `feed-complete`, `feed-mixed-missing-type`, `sleep-complete`, `sleep-start-boundary`, `multi-care-events`
- Reminders: `reminder-once`, `vague-reminder-ask`, `medicine-reminder-pending`, `vaccine-reminder-pending`
- Ledger: `expense-record`
- Growth: `growth-milestone`, `growth-measurement-complete`, `growth-measurement-ambiguous-unit`, `growth-measurement-out-of-range`, `growth-measurement-update-boundary`, `growth-measurement-delete-boundary`, `growth-measurement-duplicate-boundary`, `read-only-growth-trend-context`
- Memory and Q&A: `memory-health-pending`, `memory-preference-pending`, `memory-caregiver-pending`, `qa-care-no-memory-pollution`, `qa-care-allergy-context`
- Companion and summaries: `daily-observation-context`, `caregiver-fatigue-context`, `read-only-daily-summary-context`, `read-only-weekly-summary-context`
- Privacy and media: `private-reminder-share-boundary`, `photo-album`, `screenshot-ignore`

## Fast Gate

```bash
npm run test:agent-l2:unit
node scripts/test-agent-product-coverage-index.mjs
node scripts/test-native-capability-audit.mjs
node scripts/test-app-function-coverage-index.mjs
```

`npm run test:agent-l2:unit` should include the product index, native capability audit, and app-function coverage tests so scenario changes, feature coverage drift, mobile known-gap drift, and feature-inventory drift are caught in the same fast benchmark infrastructure gate.
