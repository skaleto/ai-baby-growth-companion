## ADDED Requirements

### Requirement: Pro trial application is persisted
The system SHALL allow a logged-in family member to submit a Pro trial application with minimal friction and persist the application for manual review.

#### Scenario: User submits a Pro trial application
- **WHEN** a logged-in user taps `申请 Pro 内测`
- **THEN** the system MUST persist an application with family id, user id, phone, source, status, created time, and updated time
- **AND** the initial status MUST be `pending`
- **AND** the user-facing confirmation MUST say that the application was received and is waiting for manual opening

#### Scenario: Same user submits again
- **WHEN** the same user in the same family submits an application again while a pending or approved application exists
- **THEN** the system MUST avoid creating confusing duplicate applications
- **AND** the UI MUST show the current application or Pro status

### Requirement: Pro trial entitlement is family-scoped
The system SHALL represent Pro trial access as a family-level entitlement.

#### Scenario: Family has Pro trial enabled
- **WHEN** a family has an enabled Pro trial entitlement
- **THEN** all family members MUST be able to see that the family is in Pro trial
- **AND** only caregiver members MUST be allowed to trigger Pro generation actions
- **AND** read-only members MUST be able to read generated family-shared Pro outputs

#### Scenario: Family has no Pro entitlement
- **WHEN** a family does not have enabled Pro trial
- **THEN** Pro-only generation actions MUST NOT call high-cost models
- **AND** the UI MAY show a Pro trial application card at approved entry points

### Requirement: AI usage is logged per call
The system SHALL record AI usage details for each backend model invocation that participates in Agent, Pro, or summary behavior.

#### Scenario: Model call succeeds with token usage
- **WHEN** a model call completes and the provider returns usage
- **THEN** the system MUST persist provider, model, feature, input type, family id, user id, request id, input tokens, output tokens, total tokens, success flag, Pro flag, quota counted flag, and created time

#### Scenario: Model call fails or omits token usage
- **WHEN** a model call fails or the provider does not return token usage
- **THEN** the system MUST still persist provider, model, feature, input type, family id, user id, request id, success flag, error code if available, Pro flag, quota counted flag, and created time
- **AND** the system MUST NOT expose token or provider internals to the user

#### Scenario: Usage threshold is exceeded in phase one
- **WHEN** a family exceeds configured weekly or monthly token thresholds
- **THEN** the system SHOULD log or surface a backend soft warning for operators
- **AND** the system MUST NOT block user behavior unless hard-limit enforcement is explicitly enabled

### Requirement: Daily summary is Pro-only and caregiver-generated
The system SHALL provide a Pro-only daily summary that caregivers can generate and all family members can read.

#### Scenario: Caregiver generates today's summary
- **WHEN** a caregiver in a Pro-enabled family requests a daily summary for a date
- **THEN** the system MUST generate a fact + gentle observation summary from family-shared data only
- **AND** the system MUST persist or overwrite the family/date summary
- **AND** the system MUST record AI usage for the generation call
- **AND** the UI MUST show the resulting summary in the Record tab Today view

#### Scenario: Read-only member tries to generate summary
- **WHEN** a read-only family member tries to generate or regenerate a daily summary
- **THEN** the system MUST deny the write/generation action
- **AND** the user MUST still be allowed to read any existing family summary

#### Scenario: Non-Pro family tries to generate summary
- **WHEN** a caregiver in a non-Pro family tries to generate a daily summary
- **THEN** the system MUST NOT call the model for summary generation
- **AND** the UI SHOULD show the Pro trial application entry

### Requirement: Daily summary uses only family-shared data
The system SHALL prevent private account data from leaking into family-shared daily summaries.

#### Scenario: Summary context is built
- **WHEN** the backend builds daily summary context
- **THEN** it MUST include only family-shared profile, care logs, growth events, saved album items, and expenses
- **AND** it MUST exclude private chat messages, private reminders, private pending effects, memories, and conversation summaries

### Requirement: Daily summary is not a timeline event
The system SHALL distinguish AI summary output from factual care timeline events.

#### Scenario: Summary appears on Today page
- **WHEN** a daily summary is displayed in the Record tab Today view
- **THEN** it MUST be labeled as an AI summary or generated summary
- **AND** it MUST NOT be inserted into the care event timeline as a factual event
- **AND** it SHOULD indicate that the summary is based on available records and may be incomplete

### Requirement: Missing item checks are conservative
The system SHALL detect possible missing items using conservative rules in phase one.

#### Scenario: Family key record is absent
- **WHEN** today's family-shared records contain no feeding record or no sleep record for a configured key type
- **THEN** the system MAY show a gentle missing item prompt such as "今天还没看到睡眠记录，要补一下吗？"
- **AND** it MUST NOT state that the user definitely forgot

#### Scenario: Current account has unfinished private items
- **WHEN** the current account has unfinished reminders, pending effects, or album confirmation prompts
- **THEN** the system MAY show account-specific missing item prompts
- **AND** these account-specific prompts MUST NOT be included in the family-shared daily summary unless the data becomes family-shared through confirmation

#### Scenario: Relative-to-history anomaly would be checked
- **WHEN** today's count is lower than recent history
- **THEN** phase one MUST NOT report this as a missing item
- **AND** historical anomaly checks MUST be deferred to a later change

### Requirement: Missing item prompts support dismiss and preference actions
The system SHALL let users respond to missing item prompts without feeling forced.

#### Scenario: Missing item prompt is shown
- **WHEN** a missing item prompt is shown
- **THEN** it SHOULD provide actions for `补一下`, `今天不用记`, and `以后别提醒这个`
- **AND** dismissing for today MUST not disable future days
- **AND** disabling future reminders MUST be stored as an account-level preference

### Requirement: Daily summary reminder is account-scoped and confirmation-based
The system SHALL schedule a lightweight daily summary reminder per account, and it SHALL NOT generate summaries automatically in the background.

#### Scenario: Reminder settings default
- **WHEN** a user has not configured daily summary reminder settings
- **THEN** the default reminder time SHOULD be `21:30`
- **AND** the reminder setting SHOULD be account-scoped

#### Scenario: Reminder fires
- **WHEN** the daily reminder fires
- **THEN** it MUST prompt the user to review missing items or generate the daily summary
- **AND** it MUST NOT call the model until an authorized caregiver confirms generation

### Requirement: Pro entry points are limited and non-intrusive
The system SHALL expose Pro trial entry points only in selected contexts to preserve the pure app experience.

#### Scenario: User views supported Pro entry points
- **WHEN** the user is on My page, Record Today daily summary area, or image/video AI trigger flow
- **THEN** the UI MAY show a Pro trial application entry

#### Scenario: User uses basic app flows
- **WHEN** the user logs in, opens the app, records basic care, views reminders, views album, or views ledger
- **THEN** the system MUST NOT show global Pro popups or block basic functionality for commercialization reasons

### Requirement: User-facing copy hides technical implementation fields
The system SHALL keep Pro and summary copy understandable and free of internal technical fields.

#### Scenario: User sees quota or summary copy
- **WHEN** the UI displays Pro status, missing items, summary generation, application state, or quota fallback
- **THEN** it MUST NOT show token, provider, model, quota_counted, dueAt, milkMl, feedingType, or other internal implementation field names
