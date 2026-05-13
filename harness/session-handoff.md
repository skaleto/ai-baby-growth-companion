# Session Handoff

Copy this file or update the sections below for long-running sessions where the next agent needs more than the progress log.

## Current Verified State

- Verified working parts:
- Commands actually run:
- Evidence files or artifacts:

## Current Work

- Active feature id:
- Goal:
- Files changed:
- Important implementation decisions:

## Still Broken Or Unverified

- Known defects:
- Blocked checks:
- Risky assumptions:

## Next Best Action

- Highest-priority next step:
- Why it is next:
- What counts as passing:
- What should not be touched:

## Commands

- Start/smoke:
  ```bash
  bash harness/init.sh
  ```
- Full local gate:
  ```bash
  bash harness/init.sh --full
  ```
- Cloud E2E gate:
  ```bash
  bash harness/init.sh --cloud
  ```
