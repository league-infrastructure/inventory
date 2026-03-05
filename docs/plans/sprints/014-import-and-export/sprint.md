---
id: '014'
title: Import and Export
status: planning
branch: sprint/014-import-and-export
use-cases:
- UC-4.9
- UC-4.10
---

# Sprint 014: Import and Export

## Goals

Implement spreadsheet import with diff/conflict detection and spreadsheet
export. This also serves as the mechanism for bulk operations.

## Problem

The existing inventory data lives in a Google Sheets spreadsheet. That data
needs to be imported into the new system. Ongoing, quartermasters need to
be able to export data for bulk editing in a spreadsheet and re-import it.

## Solution

- Import: upload Excel or CSV. System parses the file, maps columns to
  object fields, diffs against current database state, and presents
  changes for review before applying.
- Conflict detection: fields changed in the DB since the last export are
  flagged for manual review before overwrite.
- Export: download current inventory state as Excel. Includes all object
  types in separate sheets/tabs.
- All import changes are recorded in the audit log with "spreadsheet
  import" as the source.

## Success Criteria

- Quartermaster can upload a CSV/Excel file and see a diff of proposed
  changes.
- Conflicts (DB changed since last export) are highlighted for review.
- Quartermaster can approve/reject individual changes or apply all.
- Import creates audit log entries with import source.
- Export produces a well-structured Excel file with all inventory data.
- Round-trip works: export → edit in spreadsheet → re-import.

## Scope

### In Scope

- Spreadsheet import with diff preview (UC-4.9)
- Conflict detection for fields changed since last export
- Spreadsheet export (UC-4.10)
- Column mapping and validation
- Audit log entries for imports
- Bulk operations via spreadsheet round-trip

### Out of Scope

- Automatic Google Sheets sync (out of scope for project)
- Direct Google Sheets API integration

## Test Strategy

- Backend API tests: file parsing, diff generation, conflict detection,
  import application, export generation.
- Database tests: import creates correct records, audit log entries.
- Frontend tests: upload UI, diff review interface, export download.

## Architecture Notes

- Use a library like `xlsx` or `exceljs` for Excel parsing/generation.
- The diff engine compares incoming rows against existing records by
  primary key (object type + ID).
- Export includes a metadata row or sheet with export timestamp, used for
  conflict detection on re-import.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
