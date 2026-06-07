## Context

The current product direction is module-native AI with bottom navigation centered on `记录 / 相册 / 账本 / 我的`. Records are the baseline and AI is an input/organizing assistant, not a standalone chat center.

The Records today view currently places multiple high-weight modules in sequence: quick logging, inline AI, growth measurements, standalone developmental milestones, today summary, and timeline. The resulting hierarchy makes daily review feel crowded. The standalone milestone card is especially costly because it is low-frequency, score-like, and visually competes with "what happened today".

Competitor review supports a simpler split:

- Daily tracker apps emphasize quick logging, feeding/sleep/diaper/growth facts, timeline, and trends.
- Developmental milestone products work best as dedicated checklist/review tools.
- Domestic mother-baby apps often include development assessment, but their main retention surfaces are baby-centered private records, album/time flow, growth data, and family review.

## Goals / Non-Goals

**Goals:**

- Make Records feel like a daily record and review surface first.
- Keep growth measurements visible enough that users can find height, weight, and head circumference.
- Preserve developmental milestone data while lowering its daily-screen weight.
- Reframe milestone copy as low-anxiety "growth observation" instead of score-like progress.
- Keep manual logging and AI-assisted logging both available from Records.
- Keep today's summary and timeline above low-frequency growth review content.
- Produce a small, testable P0 implementation that can be visually verified on mobile.

**Non-Goals:**

- No backend data-model migration in P0.
- No new expert, medical, paid knowledge, community, ecommerce, or reminder/todo capabilities.
- No percentile, peer comparison, diagnosis, abnormality judgment, or development scoring.
- No separate Chat tab, model selector, deep-thinking switch, or AI center.
- No full redesign of Trends, Calendar, Album, Ledger, or Mine in this change.

## Decisions

### Decision 1: Move milestones under Growth instead of deleting them

Milestones should remain available because firsts and development observations are valuable long-term memory. They should not appear as a standalone daily card because daily record users mostly need immediate logging, today totals, and event review.

Alternative considered: delete milestone UI entirely. This would reduce clutter, but it would lose an existing growth-memory capability and make future photo/AI "first time" capture harder.

### Decision 2: Rename the surface to "成长观察" or "发育观察"

The main Records surface must avoid score-like milestone language such as `已记录 0/20`. A softer name signals that this is optional observation, not homework or assessment.

Alternative considered: keep "发育里程碑" but move it lower. This still carries a checklist/evaluation feel and does not fully align with low-anxiety design.

### Decision 3: Reorder Records today around daily trust

The today view should prioritize:

1. Date and current Records tab state.
2. Quick record entry.
3. Pending confirmations if any.
4. Today summary.
5. Today timeline.
6. Compact Growth card with latest measurements and a growth observation link.

This keeps the highest-frequency task in view and moves low-frequency review below daily truth.

Alternative considered: keep Growth above Today summary because growth is a strategic feature. This makes the page feel like a mixed dashboard rather than a daily tracker and repeats the current clutter problem.

### Decision 4: P0 uses existing data and views

P0 should reuse the existing `MilestonesView`, growth measurement data, and event timeline logic. The change is primarily entry placement, wording, layout order, and verification.

Alternative considered: create a new Growth detail page with `测量 / 观察` tabs immediately. That is cleaner long term but larger than needed for this cleanup pass.

## Risks / Trade-offs

- Growth observation may become too hidden → Mitigation: keep a compact row inside the Growth card with clear copy and a chevron.
- Users who used the milestone card may need one extra tap → Mitigation: preserve the same detail view and keep it reachable from Records.
- Moving cards can regress mobile layout → Mitigation: run frontend verification and screenshot Records default and opened growth observation paths.
- The word "观察" may sound vague → Mitigation: use explanatory secondary copy such as "记录宝宝最近出现的新动作和第一次".
- Existing pending AI growth/milestone drafts may still mention "发育里程碑" → Mitigation: update user-facing Records copy in the same batch; agent harness wording can be updated in a follow-up if needed.

## Migration Plan

1. Update Records today layout order without changing backend data shape.
2. Remove the standalone milestone card from the main today stack.
3. Add a compact growth observation row inside the Growth card that opens the existing milestone/detail view.
4. Update copy from "发育里程碑" to "成长观察" or "发育观察" on the Records surface.
5. Verify the Records default view and growth observation entry on mobile viewports.

Rollback is straightforward: restore the previous standalone milestone card placement and remove the compact row. No data migration is involved.

## Open Questions

- Preferred final label: `成长观察` is warmer and less clinical; `发育观察` is more precise. This spec recommends `成长观察` for the Records surface and allows the detail page to retain more precise explanatory text.
- Whether P1 should create a dedicated Growth detail page with `测量 / 观察` tabs is left for a follow-up spec after P0 cleanup is validated.
