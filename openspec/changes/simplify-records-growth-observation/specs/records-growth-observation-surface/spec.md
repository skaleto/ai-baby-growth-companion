## ADDED Requirements

### Requirement: Records today prioritizes daily record trust
The Records today view SHALL prioritize the daily logging and review path before low-frequency growth review content.

#### Scenario: User opens Records today
- **WHEN** the user opens the Records tab on the today view
- **THEN** the page MUST present quick logging before growth review content
- **AND** the page MUST present today summary and today timeline before the compact growth observation entry

#### Scenario: Today records exist
- **WHEN** the selected day has feeding, sleep, diaper, temperature, growth, album, or ledger-linked record events
- **THEN** the Records today view MUST keep the today summary and timeline visually available as the primary review surface
- **AND** low-frequency growth observation content MUST NOT push the timeline behind a large standalone card

### Requirement: Growth measurements remain discoverable
The Records today view SHALL keep growth measurements discoverable without making growth content dominate the daily surface.

#### Scenario: Growth measurements exist
- **WHEN** height, weight, or head circumference measurements exist
- **THEN** the Records today view MUST show the latest available measurement values in a compact Growth area
- **AND** the Growth area MUST provide an entry to record or view growth measurements

#### Scenario: No growth measurement exists
- **WHEN** no height, weight, or head circumference measurement exists
- **THEN** the Records today view MUST provide a low-friction entry to add the first growth measurement
- **AND** the empty state MUST NOT imply the parent has failed to complete a required task

### Requirement: Developmental milestones are reframed as growth observation
The Records today view SHALL reframe developmental milestones as optional growth observations rather than daily progress scoring.

#### Scenario: Records today renders growth observation entry
- **WHEN** the Records today view exposes the milestone/detail entry
- **THEN** the entry label on the main Records surface MUST use low-anxiety wording such as `成长观察`
- **AND** the main Records surface MUST NOT display score-like progress copy such as `已记录 0/20`

#### Scenario: User opens growth observation
- **WHEN** the user taps the growth observation entry
- **THEN** the app MUST open a detail surface where existing milestone or observation records remain viewable and maintainable
- **AND** existing milestone records MUST NOT be deleted or hidden from the detail surface

#### Scenario: Growth observation has no records
- **WHEN** the user has no growth observation or milestone records
- **THEN** the empty state MUST use optional, observational language
- **AND** the empty state MUST NOT use overdue, missing, abnormal, lagging, ranking, or peer-comparison wording

### Requirement: Standalone milestone card is removed from the daily stack
The Records today view SHALL remove the standalone high-weight developmental milestone card from the main daily stack.

#### Scenario: User scans Records today
- **WHEN** the user scans the Records today view
- **THEN** the page MUST NOT render a standalone card whose primary title is `发育里程碑` between the Growth area and today summary
- **AND** milestone or observation access MUST be nested within the Growth area or a Growth detail surface

### Requirement: AI logging remains subordinate to Records
The Records surface SHALL keep AI logging as a module-native input path rather than a separate center.

#### Scenario: User uses AI quick logging
- **WHEN** the user enters text, voice, or supported media from the Records page
- **THEN** the result MUST return to the Records context as an already-saved, pending-confirmation, needs-more-information, or ordinary reply card
- **AND** the flow MUST NOT navigate the user into a separate Chat tab

#### Scenario: User does not use AI
- **WHEN** the user chooses manual logging
- **THEN** the user MUST still be able to record core care facts and growth measurements without using AI

### Requirement: Records cleanup is visually verified on mobile
The Records cleanup SHALL be verified as a mobile-first UI change.

#### Scenario: Implementation is completed
- **WHEN** the Records today layout or growth observation entry is changed
- **THEN** frontend verification MUST include build, smoke, and mobile viewport inspection according to the project development workflow
- **AND** verification MUST include the default Records today view and the path that opens growth observation or its detail surface
