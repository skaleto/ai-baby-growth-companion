# Quality Document

Updated: 2026-06-05

This file is the quality snapshot for agent and human handoffs. Ratings are intentionally conservative.

## Rating Standard

- **A**: Verified through the expected gate, clear boundaries, stable tests.
- **B**: Verified for the current change, with small known gaps.
- **C**: Partially usable, but validation or maintainability gaps remain.
- **D**: Broken, unsafe, or not validated enough to build on.

## Product Areas

| Area | Rating | Verification Status | Agent Readability | Test Stability | Key Gap | Last Updated |
| --- | --- | --- | --- | --- | --- | --- |
| Authentication and families | B | Backend logic exists; role and sharing behavior need regression coverage when touched | Medium | Medium | Cloud/user-state regressions require live evidence | 2026-05-13 |
| Agent records and reminders | B | Agent benchmark covers core deterministic cases | High | High for L0/L1 | Real model regression remains environment-dependent | 2026-05-13 |
| Ledger | B | Feature implemented with docs and commits; E2E depends on UI/cloud state | Medium | Medium | Barcode/provider live coverage depends on external APIs | 2026-05-13 |
| Album and media | C | Core behavior exists | Medium | Medium | Media performance, thumbnails, OSS, and device preview need platform evidence | 2026-05-13 |
| OTA mobile updates | C | Update path exists | Medium | Medium | Progress fidelity and real-device update evidence should be recorded per release | 2026-05-13 |
| Frontend mobile UI | B | `docs/frontend-verification.md` defines gate | Medium | Medium | Mark A only after current `npm run verify:frontend` evidence | 2026-05-13 |
| Native Android/iOS | C | Build scripts and plugins exist | Medium | Low to Medium | Real-device notification, ringing, ASR, haptics, and safe-area behavior are device-sensitive | 2026-05-13 |

## Architecture Layers

| Layer | Rating | Boundary Discipline | Agent Readability | Key Gap | Last Updated |
| --- | --- | --- | --- | --- | --- |
| React app shell | B | Mostly clear, but large `frontend/src/App.tsx` remains dense | Medium | Future refactor could split feature panels and modal logic | 2026-05-13 |
| Mobile/native bridge | C | Platform code exists but must be validated on device | Medium | Native notification/ringing parity is hard to prove in browser | 2026-05-13 |
| Spring backend services | B | Services are reasonably separated | Medium | App state merge and family/private boundaries are high-risk when changed | 2026-05-13 |
| Agent harness/runtime | B | Runtime/config/test harness is improving | High | Add live model regression layer when stable credentials and test data are available | 2026-05-13 |
| Cloud deployment | B | Scripted deploy path exists with data-safety flags | Medium | Always distinguish code deploy, OTA deploy, data sync, and reset | 2026-05-13 |

## Quality Gates By Change Type

| Change Type | Minimum Gate |
| --- | --- |
| Agent extraction, planning, prompts, effects, reminders, expenses | `npm run test:agent-benchmark` |
| General frontend build/type changes | `npm run build` |
| UI, layout, keyboard, navigation, modal, responsive changes | `npm run verify:frontend` |
| Backend service/schema/security changes | Backend Maven tests or targeted backend tests |
| Native plugin, permissions, media, audio, haptics, notifications, WebView | `npm run mobile:sync` plus affected platform build |
| Cloud behavior or deployment | `SYNC_DATA=0 ECS_HOST=120.55.188.242 npm run deploy:aliyun` plus live health/behavior evidence |

## Current Security And Release Risks

Current release blockers are tracked in `docs/superpowers/specs/2026-06-05-release-readiness-improvement-design.md`. The historical risk log is archived at `docs/archive/completed-2026-06-05/security-risks.md`.

| Risk | Current Gate / Owner |
| --- | --- |
| HTTPS, domain, mixed-content, and cleartext traffic remain release blockers before broader distribution. | R2 release gate / `REQ-OPS-001` |
| Monitoring, alerting, deep health checks, cost alerts, and OTA failure visibility are still thin. | R1-R2 release gates / `REQ-OPS-003`, `REQ-OPS-004` |
| SQLite has no versioned migration layer and single-instance cloud topology remains a scale/rollback limit. | Later scale gate / `REQ-SCALE-001` |
| `AgentRequestGuard` is still memory-backed, so multi-instance rate and quota enforcement would drift. | Keep single instance, or move quotas to shared storage before horizontal scale |
| CSRF is disabled; current bearer-token JSON API risk is limited, but revisit before cookie sessions or public web forms. | Security review before public web expansion |
| ECS still relies on local secret files for some cloud credentials. | Harden with RAM role or managed secret path before broader release |
| Native device behavior for ASR, notifications, full-screen ringing, haptics, OTA apply, and WebView safe-area/keyboard still needs device proof. | `mobile-001` native capability gate |

## Change History

### 2026-06-05

- Recorded real-user path fixes for record-and-companion UX: additive care-log writes, no final completed tool-status rows, no missing-prompt nudges on records view, toast/quick-action layout cleanup, and voice drag-to-cancel. Verified with targeted backend tests, `npm run test:agent-benchmark`, `npm run test:agent-l2:unit`, and `npm run verify:frontend`.
- Archived the historical `docs/security-risks.md` into `docs/archive/completed-2026-06-05/security-risks.md`.
- Merged the still-current security and release risks into this live harness quality snapshot.

### 2026-05-13

- Added repo-local harness under `harness/`.
- Root `AGENTS.md` now points future sessions to harness files and project verification rules.
- Added `bash harness/init.sh` as the standard smoke entrypoint.
