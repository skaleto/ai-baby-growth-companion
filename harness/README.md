# Harness README

This directory contains the project harness for `ai-baby-growth-companion`.

It follows the Learn Harness Engineering template shape while keeping repository clutter low: the root has only `AGENTS.md`, and the operational files are collected here.

## Files

| File | Purpose |
| --- | --- |
| `feature_list.json` | Machine-readable feature state, priority, validation steps, and evidence. |
| `claude-progress.md` | Human-readable current state and session log. |
| `init.sh` | Standard initialization and smoke verification entrypoint. |
| `quality-document.md` | Quality snapshot across product areas and architecture layers. |
| `clean-state-checklist.md` | Checklist before ending a session or handing work off. |
| `session-handoff.md` | Template for longer handoff notes. |
| `evaluator-rubric.md` | Review rubric for accepting or revising a change. |

## Default Flow

```bash
bash harness/init.sh
```

Use the default smoke gate before normal coding. Use `bash harness/init.sh --full` before major releases or risky backend/frontend changes. Use `bash harness/init.sh --cloud` only when the live test account and cloud environment are intentionally being exercised.

## Evidence Rule

Do not mark work as complete just because code was edited. Completion requires evidence from a command, a screenshot/artifact, a database/service probe, or a documented blocked check.
