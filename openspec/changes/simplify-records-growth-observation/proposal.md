## Why

The Records page has become visually and conceptually crowded: quick logging, inline AI, growth measurements, a standalone milestone card, today metrics, timeline, trends, and calendar all compete in the same surface. Competitor review suggests that daily baby tracker apps prioritize immediate logging, today summary, event timeline, and trend review; developmental milestones are useful but usually work better as a lower-frequency checklist or growth-detail surface rather than a high-weight daily card.

This change keeps the product direction of "records and low-anxiety companionship" while reducing record-page clutter. It preserves developmental milestone data, but reframes it as "growth observation" and moves it under the growth domain instead of presenting it as a daily score-like module.

## What Changes

- Reorder the Records today view around the primary daily job: quick log, today summary, pending confirmations, today timeline, then growth review.
- Remove the standalone high-weight "发育里程碑" card from the Records today surface.
- Reframe milestones as "成长观察" or "发育观察" inside the Growth area, with softer copy and no score-like `0/N` progress shown on the main daily screen.
- Keep the milestone/detail view available from Growth, but treat it as a low-frequency review/edit surface.
- Keep AI as a module-native logging assistant inside Records; do not reintroduce a separate Chat tab or model/mode controls.
- Keep manual logging as the baseline path for feeding, sleep, diaper/poop, temperature, growth measurement, and growth observation.
- Ensure today's summary and timeline remain the core trust surface and are not pushed below low-frequency growth content.
- Do not add expert content, paid knowledge, community, ecommerce, or new reminder/todo capabilities in this change.

## Capabilities

### New Capabilities

- `records-growth-observation-surface`: Defines how the Records page prioritizes daily logging, today summary, timeline, growth measurements, and low-anxiety growth observation.

### Modified Capabilities

- None. The existing OpenSpec capability is `development-workflow`, which is not changed by this product spec.

## Impact

- Frontend Records page layout and copy in `frontend/src/App.tsx`.
- Records and growth-related mobile styles in `frontend/src/styles/mobile-app.css` and responsive styles if needed.
- Existing `MilestonesView` usage and entry placement.
- Frontend smoke coverage for Records default view and growth observation entry.
- Product documentation and harness evidence may need updates after implementation.
- No backend API schema change is expected for P0; existing growth measurement and milestone data can be reused.
