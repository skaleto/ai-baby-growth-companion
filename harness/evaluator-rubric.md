# Evaluator Rubric

Use this after implementation and before declaring a feature complete.

Score each dimension from 0 to 2:

- **0**: missing, unverified, or misleading.
- **1**: partially satisfied with explicit gaps.
- **2**: satisfied with evidence.

| Dimension | Question | Score | Notes |
| --- | --- | --- | --- |
| Correctness | Does the behavior match the user's requested outcome and project rules? |  |  |
| Verification | Were the required commands or live checks actually run? |  |  |
| Scope Discipline | Did the change avoid unrelated refactors and hidden fallback behavior? |  |  |
| Reliability | Does the behavior survive reload, restart, redeploy, or repeated use where relevant? |  |  |
| User Safety | Could the change corrupt family data, production data, reminders, media, or billing records? |  |  |
| Agent Continuity | Can the next session continue from repo files without relying on chat memory? |  |  |
| Observability | Are failures diagnosable through logs, result docs, screenshots, DB evidence, or artifacts? |  |  |

## Decision

- **Accept**: no 0 scores, verification evidence exists, and residual risk is acceptable.
- **Revise**: one or more 1 scores need targeted follow-up, but no release-blocking issue remains.
- **Block**: any 0 score in correctness, verification, user safety, or reliability.

## Required Notes

- Missing evidence:
- Must-fix issues:
- Follow-up tests:
- Release or deploy decision:
