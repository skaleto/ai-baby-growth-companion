## ADDED Requirements

### Requirement: Explicit expense recording intent saves complete records
The Agent SHALL automatically save complete recognized expense records to the ledger when the user explicitly asks to record those expenses.

#### Scenario: Complete expense screenshots are recorded
- **WHEN** a caregiver sends expense screenshots and asks to record them in the ledger
- **THEN** the system MUST save every recognized expense that has title or purpose, amount, date, and baby or pregnancy relevance

#### Scenario: Complete previous recognized expenses are recorded
- **WHEN** a caregiver asks to record the expenses from the previous or above message
- **THEN** the system MUST use the previously recognized expense candidates or referenced attachments and save complete candidates without requiring the caregiver to confirm an older message card

#### Scenario: Saved result is reflected in chat
- **WHEN** complete recognized expenses are saved automatically
- **THEN** the final chat reply MUST state how many expenses were saved and MUST NOT show copy that says the user still needs to confirm those saved expenses

### Requirement: Recognition-only requests do not write ledger records
The Agent SHALL keep expense recognition read-only unless the user expresses clear intent to record the expenses.

#### Scenario: User only asks to identify expenses
- **WHEN** a user asks to identify, inspect, summarize, or calculate expense screenshots without asking to record them
- **THEN** the system MUST present the recognized expense summary without creating ledger records

#### Scenario: User later asks to record recognized expenses
- **WHEN** a user first asks for recognition only and then later asks to record the recognized expenses
- **THEN** the system MUST save complete previously recognized candidates without re-asking for confirmation

### Requirement: Pending confirmation is minimized
The Agent SHALL create pending expense confirmations only when core facts or relevance are missing or uncertain.

#### Scenario: Missing core amount
- **WHEN** a recognized expense candidate lacks an actual paid amount or the amount is unstable
- **THEN** the system MUST ask for the amount or leave that item pending instead of saving it

#### Scenario: Missing category only
- **WHEN** a recognized expense has complete title or purpose, amount, date, and relevance but category is missing or uncertain
- **THEN** the system MUST save the expense using a coarse inferred category or `other` rather than blocking on confirmation

#### Scenario: Mixed complete and incomplete batch
- **WHEN** a batch contains both complete expense candidates and incomplete candidates
- **THEN** the system MUST save complete candidates and ask only for the incomplete candidates

### Requirement: Expense persistence is duplicate-safe
The backend SHALL prevent duplicate ledger entries from repeated confirmations, repeated messages, and repeated recognition of the same expense.

#### Scenario: Same pending effect is confirmed twice
- **WHEN** the same pending expense effect is confirmed more than once
- **THEN** the backend MUST save it at most once and return a state that does not contain duplicate ledger rows

#### Scenario: Same recognized expenses appear on multiple messages
- **WHEN** the same recognized expense candidates are attached to more than one AI message or pending effect
- **THEN** confirming or saving those candidates MUST NOT create duplicate ledger rows

#### Scenario: Same screenshots are recorded again
- **WHEN** a caregiver asks to record screenshots that match existing ledger expenses by source or normalized content
- **THEN** the system MUST skip duplicate records and report that they were already in the ledger

### Requirement: Expense category inference is coarse and non-blocking
The Agent SHALL infer an existing coarse ledger category for common pregnancy and baby expenses and SHALL NOT require user confirmation solely for category uncertainty.

#### Scenario: Pregnancy clothing is classified
- **WHEN** an expense title or note contains月子鞋, 月子服, or similar pregnancy clothing terms
- **THEN** the recognized expense category MUST be `clothing`

#### Scenario: Baby feeding appliances are classified
- **WHEN** an expense title or note contains摇奶器, 恒温壶, 奶瓶, 奶瓶刷, 消毒柜, 温奶器, or 吸奶器
- **THEN** the recognized expense category MUST be `daily`

#### Scenario: Unknown category falls back
- **WHEN** an expense is otherwise complete but no category can be inferred
- **THEN** the system MUST save it as `other`

### Requirement: Final expense replies are based on persistence facts
The Agent SHALL generate final expense replies from actual persistence results while preserving natural model expression.

#### Scenario: Save succeeds
- **WHEN** expense persistence saves one or more records
- **THEN** the final reply MUST include a concise saved summary based on the actual saved records

#### Scenario: Duplicates are skipped
- **WHEN** expense persistence skips duplicate records
- **THEN** the final reply MUST mention that those records already existed and were not saved again

#### Scenario: Some records need input
- **WHEN** some recognized expense candidates need additional user input
- **THEN** the final reply MUST identify only those unresolved items as needing information

#### Scenario: Persistence fails
- **WHEN** expense persistence fails to save records
- **THEN** the final reply MUST NOT claim that the records were saved

### Requirement: Confirmation UI is idempotent and stateful
The frontend SHALL prevent accidental repeated confirmation and SHALL update chat UI after confirmation succeeds.

#### Scenario: User taps confirm
- **WHEN** a caregiver taps a pending expense confirmation button
- **THEN** the frontend MUST show a saving state and prevent a second confirmation click for the same pending effect until the request completes

#### Scenario: Confirmation succeeds
- **WHEN** a pending expense confirmation succeeds
- **THEN** the frontend MUST remove or replace the pending confirmation card with a saved result state and MUST NOT keep stale "needs more information" copy for saved records

#### Scenario: Confirmation was already applied
- **WHEN** the backend reports that a pending expense was already confirmed or deduplicated
- **THEN** the frontend MUST present the result as saved or already existing instead of allowing another duplicate save
