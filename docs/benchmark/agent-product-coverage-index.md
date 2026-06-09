# Agent/Product Benchmark Coverage Index

Updated: 2026-06-06

Generated/maintained alongside `scripts/l2-benchmark/product-coverage-index.mjs`.

This file answers one narrow question: for every current feature tracked in `harness/feature_list.json`, what proves it is covered, and what is still a known gap?

May commercialization, DailySummaryView, independent Chat-tab, and AI-reminder decisions were deleted or superseded. They are not current coverage targets.

| Feature | Status | Primary coverage | Remaining gap / next action |
|---|---|---|---|
| `harness-001` | covered by non-agent gate | `bash harness/init.sh` verifies repo state, whitespace, frontend build, and Agent benchmark. | Keep this as the restart contract. |
| `product-ia-2026-06-06` | covered by non-agent gate | `npm run verify:frontend` plus the module-native AI spec define the Records-first shell and mobile UI proof. | After implementation, refresh smoke assertions for `记录 / 相册 / 账本 / 我的`. |
| `agent-tool-first-2026-06-06` | known gap | Current spec exists; representative L2 scenarios are `feed-complete`, `growth-measurement-complete`, and `expense-record`. | Implement controlled Agent action tools and make final replies depend on tool results. |
| `agent-context-harness-2026-06-06` | covered | `npm run test:agent-benchmark` covers Chinese harness injection and deterministic bad-case regressions. | Re-run bounded live checks only when model-facing harness behavior changes. |
| `frontend-001` | covered by non-agent gate | `npm run verify:frontend` and `docs/verification/frontend-verification.md`. | UI changes need fresh evidence; build alone is not enough. |
| `cloud-001` | covered by non-agent gate | `SYNC_DATA=0` deploy discipline, `/api/health`, OTA probes, and behavior-specific cloud checks. | Health alone does not prove Agent, persistence, media, or cross-user behavior. |
| `mobile-001` | known gap | `scripts/native-capability-audit.mjs` and `docs/benchmark/native-capability-benchmark.md` track static evidence. | Add real device probes for OS-level input/delivery/apply behavior. |
| `release-hardening-2026-06-05` | covered by non-agent gate | Release-hardening spec and quality snapshot define readiness blockers. | Execute the release checklist before broader beta or public release. |
| `legal-data-2026-06-06` | covered by non-agent gate | `docs/legal/` keeps legal/data-processing drafts separate from deleted May decisions. | Refresh legal text after real data flow and provider list settle. |

## Representative Agent Scenarios

- Records: `feed-complete`, `feed-mixed-missing-type`, `sleep-complete`, `sleep-start-boundary`, `multi-care-events`
- Growth: `growth-measurement-complete`, `growth-measurement-ambiguous-unit`, `growth-measurement-out-of-range`, `growth-measurement-update-boundary`, `growth-measurement-delete-boundary`, `growth-measurement-duplicate-boundary`
- Ledger: `expense-record`
- Album/media: `photo-album`, `screenshot-ignore`
- Companion/read-only context: `daily-observation-context`, `caregiver-fatigue-context`, `read-only-growth-trend-context`

Reminder/todo scenarios may remain as historical benchmark fixtures while product code is being unwound, but the current Agent tool-first migration must not expose AI reminder/todo write tools.

## Fast Gate

```bash
npm run test:agent-l2:unit
node scripts/test-agent-product-coverage-index.mjs
node scripts/test-native-capability-audit.mjs
node scripts/test-app-function-coverage-index.mjs
```
