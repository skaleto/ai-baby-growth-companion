# Clean State Checklist

Use this before ending a session, especially before commit, push, deploy, or handoff.

- [ ] `git status --short` has been checked.
- [ ] Unrelated user or prior-agent changes were preserved.
- [ ] `git diff --check` passed or the failure is documented.
- [ ] The smallest appropriate verification gate was run.
- [ ] UI changes followed `docs/verification/frontend-verification.md` or have a documented waiver.
- [ ] Agent behavior changes ran `npm run test:agent-benchmark`.
- [ ] Native-risk changes ran `npm run mobile:sync` and attempted the affected platform build.
- [ ] Cloud updates used data-safe flags unless a data sync/reset was explicitly requested.
- [ ] Feature status/evidence was updated in `harness/feature_list.json` or the relevant `docs/` result file.
- [ ] `harness/feature_list.json` reflects the actual current state.
- [ ] Blocked checks and residual risk are explicit in the final handoff.
- [ ] No task is marked passing just because code was edited.
