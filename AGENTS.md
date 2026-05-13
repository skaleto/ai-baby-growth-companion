# AGENTS.md

This repository uses a repo-local harness for long-running agent work. The goal is not to move fast by memory; the goal is to let the next session restart from files in the repo, run the same gates, and continue without guessing.

All harness files live under `harness/` except this root entry file.

## Start Every Session

1. Confirm the repository root with `pwd`.
2. Read `harness/claude-progress.md` for the latest verified state and next step.
3. Read `harness/feature_list.json` before choosing or changing feature scope.
4. Check `git status --short` and `git log --oneline -5`.
5. Run the standard harness entrypoint:

```bash
bash harness/init.sh
```

If the baseline gate fails, fix the baseline first or clearly record the blocker before stacking more work on top.

## Required Harness Files

- `harness/feature_list.json`: feature state and evidence tracker.
- `harness/claude-progress.md`: current progress, validated state, and next action.
- `harness/init.sh`: standard repo initialization and verification entrypoint.
- `harness/quality-document.md`: quality snapshot by product area and architecture layer.
- `harness/clean-state-checklist.md`: final handoff checklist.
- `harness/session-handoff.md`: optional long-session handoff note.
- `harness/evaluator-rubric.md`: review rubric before accepting work.

## Project Rules

- This is a mobile-first React + Capacitor app with a Java/Spring backend.
- Preserve user or prior-agent changes. Never revert unrelated work to make your diff cleaner.
- One active feature at a time. Do not widen scope unless it removes a direct blocker.
- Major product iterations should leave a concise markdown plan or record under `docs/`.
- Agent behavior changes must update or run the agent benchmark:

```bash
npm run test:agent-benchmark
```

- UI, styling, mobile layout, navigation, forms, keyboard behavior, or user-facing interaction changes must follow `docs/frontend-verification.md`.
- Build success alone is not enough evidence for UI work. Use:

```bash
npm run verify:frontend
```

- Native-risk changes touching `capacitor.config.ts`, `ios/`, `android/`, native plugins, permissions, camera/media/file/audio/haptics/notifications, safe areas, keyboard, or WebView-only logic must run:

```bash
npm run mobile:sync
```

Then attempt the relevant native build when the local environment supports it:

```bash
npm run build:ios:debug
npm run build:android:debug
```

## Cloud And Data Safety

- Current Aliyun host is `120.55.188.242`; older `8.210.235.155` references are stale unless the user explicitly says otherwise.
- Default backend port is `8300`.
- Deployment script defaults are in `scripts/deploy-aliyun-ecs.sh`.
- Do not overwrite or sync production data unless the user explicitly asks for data migration/reset. For code-only deployment, prefer:

```bash
SYNC_DATA=0 ECS_HOST=120.55.188.242 npm run deploy:aliyun
```

- Production evidence should include service health plus persisted behavior when relevant; `/api/health` alone does not prove Agent, reminder, media, or state persistence behavior.

## Definition Of Done

A feature is done only when:

- the target behavior is implemented;
- the appropriate verification was actually run;
- evidence is recorded in `harness/feature_list.json`, `harness/claude-progress.md`, or the relevant `docs/` result file;
- known gaps and blocked checks are explicit;
- the repo can be restarted through `bash harness/init.sh`.

## End Every Session

Before final handoff:

1. Update harness progress or feature evidence when the work is substantial.
2. Run `git diff --check`.
3. Run the smallest verification that matches the risk.
4. Mention commands run, blocked checks, and residual risk.
5. Leave the worktree state clear in the final answer.
