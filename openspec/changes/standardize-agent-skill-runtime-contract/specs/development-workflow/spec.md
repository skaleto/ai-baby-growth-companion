## MODIFIED Requirements

### Requirement: Agent behavior changes require benchmark coverage
The development workflow SHALL require deterministic benchmark coverage for Agent behavior changes, especially skill planning, executable skill runtime behavior, effect decisions, and persistence gates.

#### Scenario: Agent skill routing changes
- **WHEN** Codex changes `AgentPlanner`, `SkillRouter`, executable skill selection, or previous-media reference handling
- **THEN** Codex MUST add or update benchmark or backend tests that prove the intended skill plan and runtime execution path

#### Scenario: Executable skill output contract changes
- **WHEN** Codex changes an executable skill prompt, output parsing, field normalization, or error handling
- **THEN** Codex MUST add or update tests for complete output, incomplete output, and a boundary case that must not create unsafe structured effects

#### Scenario: Persistence behavior changes
- **WHEN** Codex changes automatic saving, pending confirmation, duplicate detection, or idempotency for Agent-generated effects
- **THEN** Codex MUST verify the domain persistence result, the returned effect decisions, and the final user-visible response state

#### Scenario: Frontend chat interaction changes
- **WHEN** Codex changes chat attachment submission, stream status, confirmation card state, or frontend handling of Agent effect decisions
- **THEN** Codex MUST run frontend verification in addition to Agent benchmark and MUST report any real-device-only risk
