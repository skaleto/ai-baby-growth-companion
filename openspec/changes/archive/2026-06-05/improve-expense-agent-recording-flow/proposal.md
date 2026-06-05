## Why

The expense Agent currently mixes recognition, confirmation, and persistence in a way that makes users repeat confirmations, leaves misleading "needs more information" copy after records are saved, and can duplicate expenses when the same recognized result is confirmed through multiple messages.

This change turns expense recording into a clear intent-driven flow: recognize first, persist complete records automatically when the user asked to record them, and make the final reply reflect the actual saved/skipped/needs-input result.

## What Changes

- Automatically save complete expense records when the user has clear recording intent and the recognized records include the core facts: title or purpose, amount, date, and baby/pregnancy relevance.
- Keep pure recognition requests read-only: users who ask to "look at" or "identify" receipts receive a summary without writing to the ledger.
- Minimize pending confirmations to truly incomplete or risky cases such as missing amount, missing date, unclear purpose, unreadable image, or unclear baby/pregnancy relevance.
- Make pending-effect confirmation idempotent and prevent duplicate saves from double taps, repeated messages, and repeated pending effects.
- Add backend duplicate protection for expenses using stable source and content keys, so repeated recognition of the same expense is skipped instead of inserted again.
- Preserve model-led natural replies while binding them to persistence facts: newly saved count, skipped duplicate count, and items needing more information.
- Improve expense category inference so classification is automatically coarse-grained and never blocks saving when other core fields are complete.
- Ensure confirmed or auto-saved expense results do not keep stale "needs more information" UI cards in chat.
- This change does not delete existing production duplicate rows; the user will manually delete those from ledger details.

## Capabilities

### New Capabilities
- `expense-agent-recording-flow`: Defines intent-driven expense recognition, automatic ledger persistence, duplicate protection, confirmation minimization, category inference, and result messaging.

### Modified Capabilities
None.

## Impact

- Backend Agent runtime, expense-recognition skill, effect policy, app state persistence, pending-effect confirmation, and tests.
- Frontend chat pending-effect rendering, confirm button state, auto-save result display, and expense normalization.
- Agent benchmark coverage for auto-save, read-only recognition, duplicate skipping, confirmation minimization, and category inference.
- OpenSpec and harness documentation for the confirmed interaction contract.
