# Harness README

This directory contains the project harness for `ai-baby-growth-companion`.

It follows the Learn Harness Engineering template shape while keeping repository clutter low: the root has only `AGENTS.md`, and the operational files are collected here.

## Files

| File | Purpose |
| --- | --- |
| `project-index.md` | Top-level repository navigation map: what to read, ignore, archive, or protect. |
| `feature_list.json` | Machine-readable feature state, priority, validation steps, and evidence. |
| `claude-progress.md` | Human-readable current state and session log. |
| `app-development-roadmap.md` | Current product development trajectory and strategic source of truth for app direction. |
| `agent-model-context-harness.md` | Model-facing context and bad-case harness injected into agent planner/tool/final prompts. |
| `init.sh` | Standard initialization and smoke verification entrypoint. |
| `quality-document.md` | Quality snapshot across product areas and architecture layers. |
| `clean-state-checklist.md` | Checklist before ending a session or handing work off. |
| `session-handoff.md` | Template for longer handoff notes. |
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

Use `app-development-roadmap.md` as the current source of truth for product direction. Historical market research, competitor research, draft strategy files, and slide decks are archived under `docs/research-archive/` and must be treated as reference evidence only.

## Agent Harness Rule

Use `agent-model-context-harness.md` as structured Markdown for model behavior. Use JSON or JS fixtures only for benchmark cases and assertions. Current supporting docs:

- `docs/agent-harness-case-audit-2026-06-06.md`
- `docs/agent-harness-live-benchmark-results.md`
- `docs/agent-harness-live-benchmark-results-doubao.md`
- `docs/agent-harness-model-comparison-2026-06-06.md`
