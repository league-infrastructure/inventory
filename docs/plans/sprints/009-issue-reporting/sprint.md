---
id: 009
title: Issue Reporting
status: planning
branch: sprint/009-issue-reporting
use-cases:
- UC-3.1
- UC-3.2
- UC-3.3
---

# Sprint 009: Issue Reporting

## Goals

Implement the issue reporting and resolution workflow: flag missing items,
flag consumables needing replenishment, and resolve issues.

## Problem

When instructors find missing items or depleted consumables, there is no
structured way to report this or track resolution. Discrepancies from
inventory checks (sprint 007) need to feed into a manageable issue queue.

## Solution

- Flag a missing item: from a Pack view, mark a specific Item as missing
  with an optional note.
- Flag consumable replenishment: from a Pack view, mark a consumable as
  needing replenishment.
- Issue queue: quartermasters see all open issues, filterable by Kit/Pack,
  type (missing vs. replenishment), and date.
- Resolve an issue: quartermaster marks an issue resolved after action is
  taken.
- Issues can also be auto-created from inventory check discrepancies.

## Success Criteria

- Instructor can scan a Pack QR and flag a missing item or consumable.
- Issues appear in the quartermaster's issue queue.
- Quartermaster can resolve issues with a note.
- Resolved issues are retained in history.
- All actions recorded in audit log.

## Scope

### In Scope

- Flag missing item (UC-3.1)
- Flag consumable replenishment (UC-3.2)
- Resolve an issue (UC-3.3)
- Issue queue view for quartermasters
- Link between inventory check discrepancies and issues
- Issue history

### Out of Scope

- Notifications when issues are created or resolved (out of scope for project)
- Open issues report (sprint 011, UC-5.5)

## Test Strategy

- Backend API tests: issue creation, resolution, query/filter.
- Database tests: issue records, linkage to Packs/Items.
- Frontend tests: flag-issue flow, issue queue, resolution flow.

## Architecture Notes

- An issue has: type (missing_item | replenishment), status (open |
  resolved), linked Pack + Item, reporter, resolver, notes, timestamps.
- Issues created from inventory check discrepancies link back to the
  check record.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
