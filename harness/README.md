# Harness README

This directory contains the project harness for `ai-baby-growth-companion`. The repo root keeps only `AGENTS.md`; the operational files live here.

## Files

| File | Purpose |
| --- | --- |
| `project-index.md` | Top-level repository navigation map: what to read, ignore, or protect. |
| `feature_list.json` | Machine-readable feature state, priority, validation steps, and evidence. |
| `app-development-roadmap.md` | Current product development trajectory and strategic source of truth. |
| `agent-model-context-harness.md` | Model-facing context and bad-case harness injected into agent prompts. |
| `init.sh` | Standard initialization and smoke verification entrypoint. |
| `quality-document.md` | Quality snapshot across product areas and architecture layers. |
| `clean-state-checklist.md` | Checklist before ending a session or handing work off. |
| `evaluator-rubric.md` | Review rubric for accepting or revising a change. |

## Default Flow

```bash
bash harness/init.sh
```

Read `project-index.md` before broad repository cleanup, onboarding, or choosing where a new document should live.

Use the default smoke gate before normal coding. Use `bash harness/init.sh --full` before major releases or risky backend/frontend changes. Use `bash harness/init.sh --cloud` only when the live test account and cloud environment are intentionally being exercised.

## Evidence Rule

Do not mark work as complete just because code was edited. Completion requires evidence from a command, a screenshot/artifact, a database/service probe, or a documented blocked check.

## Strategy Rule

Use `app-development-roadmap.md` as the current source of truth for product direction. Past market/competitor research and superseded specs were removed during cleanup and remain in git history as reference only.

## Agent Harness Rule

Use `agent-model-context-harness.md` as structured Markdown for model behavior. Use JSON or JS fixtures only for benchmark cases and assertions. Benchmark sources and coverage live under `docs/benchmark/`; per-run `*-results.md` outputs are script-generated and gitignored.
