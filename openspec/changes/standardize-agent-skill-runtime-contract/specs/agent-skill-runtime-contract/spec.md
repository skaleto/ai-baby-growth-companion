## ADDED Requirements

### Requirement: Agent capabilities use a skill runtime contract
Executable Agent capabilities SHALL follow a single contract: planner selects skill, runtime executes skill, EffectPolicy validates effects, and domain services persist only authorized structured changes.

#### Scenario: Planner selects an executable skill
- **WHEN** a user request requires a registered executable Agent capability
- **THEN** `AgentPlanner` MUST express that capability as a `skillRequests` entry with `mode=execute`

#### Scenario: Runtime receives a skill request
- **WHEN** `SkillRouter` receives planner-selected executable skill requests
- **THEN** it MUST allow only registered executable skills and MUST keep unsupported or unsafe skill requests out of the execution plan

#### Scenario: Final model composes the reply
- **WHEN** an executable skill has produced a result for a capability
- **THEN** the final composer MUST use the skill result as the structured fact source and MUST NOT create parallel same-type structured candidates that bypass the skill

### Requirement: Runtime owns safety and structured fallback
The backend runtime SHALL own permission checks, family data boundaries, structured field normalization, duplicate protection, persistence gates, and user-visible fallback copy for executable skill results.

#### Scenario: Skill output contains a write candidate
- **WHEN** a skill returns an effect candidate that could create or update product data
- **THEN** runtime and domain services MUST validate authorization, required fields, idempotency, duplicate rules, and persistence status before exposing the effect as saved or pending

#### Scenario: Skill output is incomplete
- **WHEN** a skill cannot produce a complete structured candidate
- **THEN** runtime MUST return a capability-specific clarification or failure state instead of letting the final model invent a write candidate

#### Scenario: Skill execution is traced
- **WHEN** runtime executes an executable skill
- **THEN** it MUST record enough trace metadata to debug skill selection, input references, status, result summary, error code, and duration without storing raw base64 media payloads

### Requirement: Previous media references are resolved by backend runtime
The Agent SHALL resolve user references to recent media evidence through backend context and storage instead of relying on frontend natural-language matching.

#### Scenario: User references prior expense screenshots
- **WHEN** a caregiver asks to record expenses from images uploaded in a previous message
- **THEN** planner MUST be able to choose `expense-recognition`, and runtime MUST hydrate the referenced recent visual attachments by id and family boundary before executing the skill

#### Scenario: Current request has no attachment bytes
- **WHEN** the current chat request has no attachment `dataUrl` but recent messages contain visual attachment metadata
- **THEN** runtime MAY load those attachments from backend storage for the selected skill, limited to the configured visual attachment cap

#### Scenario: Referenced media is missing
- **WHEN** runtime cannot load the referenced media
- **THEN** the skill result or runtime fallback MUST explain that the image evidence is unavailable and MUST NOT pretend an amount or ledger record was recognized

### Requirement: Expense recognition is the first executable skill path
Expense screenshot recognition SHALL use `expense-recognition` as its executable skill path for current screenshots and previous-image retry requests.

#### Scenario: Current expense screenshots are submitted
- **WHEN** a caregiver submits order, receipt, invoice, payment, or checkout screenshots and asks to recognize or record expenses
- **THEN** Agent MUST execute `expense-recognition` and MUST NOT perform web search for the actual paid amount

#### Scenario: Previous expense screenshots are retried
- **WHEN** a caregiver says the equivalent of "record the expenses from the images above/just uploaded/previously sent"
- **THEN** Agent MUST execute `expense-recognition` on the referenced recent media if those media records are available

#### Scenario: Category is uncertain
- **WHEN** `expense-recognition` has title or purpose, amount, date, and evidence but lacks a confident category
- **THEN** the system MUST infer a coarse category or use `other` and MUST NOT block recording solely to ask for category

#### Scenario: Complete recognized expenses are recorded
- **WHEN** a caregiver clearly asks to record complete recognized expenses
- **THEN** the backend MUST persist complete candidates through the expense persistence gate and expose saved, duplicate, or needs-input facts in the final response
