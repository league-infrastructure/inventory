---
id: '022'
title: Validation, Bug Fixes, and Infrastructure
status: done
branch: sprint/022-validation-bug-fixes-and-infrastructure
---

# Sprint 022: Validation, Bug Fixes, and Infrastructure

## Goals

Address accumulated TODOs from testing and usage: add missing validation
rules, extract the OS service layer, fix the computer/kit site sync bug,
commit the label layout redesign, add pg_dump to Docker, and clean up
test artifacts.

## Scope

### In Scope

1. Label layout redesign — commit existing work from previous session
2. Require minimum fields on computer create
3. Enforce single home site constraint
4. Create OS service with validation
5. Fix computer/kit site sync bug
6. Install pg_dump in Docker for backups
7. Clean up orphan test hostnames

### Out of Scope

- Migrate people from sites to custodians (needs stakeholder decision)
- Slack bot AI inventory (large feature, separate project)

## Test Strategy

- Server tests for new validation rules
- Manual verification of label printing
- Verify pg_dump available in Docker container
