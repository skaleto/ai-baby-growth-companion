# Quality Document

Updated: 2026-06-06

This file is the quality snapshot for agent and human handoffs. Ratings are intentionally conservative.

## Rating Standard

- **A**: Verified through the expected gate, clear boundaries, stable tests.
- **B**: Verified for the current change, with small known gaps.
- **C**: Partially usable, but validation or maintainability gaps remain.
- **D**: Broken, unsafe, or not validated enough to build on.

## Product Areas

| Area | Rating | Verification Status | Agent Readability | Test Stability | Key Gap | Last Updated |
| --- | --- | --- | --- | --- | --- | --- |
| Authentication and families | B | Backend logic exists; role and sharing behavior need regression coverage when touched | Medium | Medium | Cloud/user-state regressions require live evidence | 2026-06-06 |
| Agent records and ledger | B- | Current direction is tool-first; old deterministic write path still exists until migration | High | High for L0/L1 | Tool-first P0 needs implementation and L2 app-state evidence | 2026-06-06 |
| Ledger | B | Manual ledger exists; text/image AI ledger direction now lives in current specs | Medium | Medium | Pending expense source of truth must be backend-persisted | 2026-06-06 |
| Album and media | C | Core behavior exists; new direction requires by-day timeline | Medium | Medium | Media performance, thumbnails, OSS, and device preview need platform evidence | 2026-06-06 |
| OTA mobile updates | B | Recent releases verified checksum and production API base URL | Medium | Medium | Real-device Capgo apply proof still needed per release | 2026-06-06 |
| Frontend mobile UI | B | `docs/verification/frontend-verification.md` defines gate; recent simplification passed smoke | Medium | Medium | Module-native navigation/default-home changes still need fresh `verify:frontend` | 2026-06-06 |
| Native Android/iOS | C | Build scripts and plugins exist | Medium | Low to Medium | Real-device notification, ringing, ASR, haptics, and safe-area behavior are device-sensitive | 2026-06-06 |

## Architecture Layers

| Layer | Rating | Boundary Discipline | Agent Readability | Key Gap | Last Updated |
| --- | --- | --- | --- | --- | --- |
| React app shell | B- | `frontend/src/App.tsx` remains dense and owns much of navigation/UI state | Medium | Module-native navigation should avoid adding more tangled state | 2026-06-06 |
| Mobile/native bridge | C | Platform code exists but must be validated on device | Medium | Native notification/ringing parity is hard to prove in browser | 2026-06-06 |
| Spring backend services | B | Services are reasonably separated | Medium | App state merge and family/private boundaries are high-risk when changed | 2026-06-06 |
| Agent harness/runtime | B- | Harness exists, but current implementation still relies on old write path | High | Implement backend Agent action tools and app-state-backed pending effects | 2026-06-06 |
| Cloud deployment | B | Scripted deploy path exists with data-safety flags | Medium | Always distinguish code deploy, OTA deploy, data sync, and reset | 2026-06-06 |

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

Current release blockers are tracked in `docs/release/release-readiness.md`. The old May risk log and archived decision docs were deleted from the workspace on 2026-06-06; current release risk should be read from this file and the release-hardening spec only.

| Risk | Current Gate / Owner |
| --- | --- |
| HTTPS, domain, mixed-content, and cleartext traffic remain release blockers before broader distribution. | R2 release gate / `REQ-OPS-001` |
| Monitoring, alerting, deep health checks, cost alerts, and OTA failure visibility are still thin. | R1-R2 release gates / `REQ-OPS-003`, `REQ-OPS-004` |
| SQLite has no versioned migration layer and single-instance cloud topology remains a scale/rollback limit. | Later scale gate / `REQ-SCALE-001` |
| `AgentRequestGuard` is still memory-backed, so multi-instance rate and quota enforcement would drift. | Keep single instance, or move quotas to shared storage before horizontal scale |
| CSRF is disabled; current bearer-token JSON API risk is limited, but revisit before cookie sessions or public web forms. | Security review before public web expansion |
| ECS still relies on local secret files for some cloud credentials. | Harden with RAM role or managed secret path before broader release |
| Native device behavior for ASR, notifications, full-screen ringing, haptics, OTA apply, and WebView safe-area/keyboard still needs device proof. | `mobile-001` native capability gate |
