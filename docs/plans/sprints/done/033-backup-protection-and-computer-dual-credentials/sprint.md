---
id: '033'
title: Backup Protection and Computer Dual Credentials
status: done
branch: sprint/033-backup-protection-and-computer-dual-credentials
use-cases:
- SUC-001
- SUC-002
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Sprint 033: Backup Protection and Computer Dual Credentials

## Goals

1. Prevent manual deletion of scheduled (daily/weekly) backups through
   the UI or API — only ad-hoc backups can be deleted manually.
2. Add student credentials fields to the Computer model so each computer
   can store both admin and student username/password pairs. Update the
   detail form, label printing, and existing data.

## Problem

1. Scheduled backups (daily/weekly) managed by the rotation system can
   currently be deleted manually, which could break the rotation logic.
2. Computers only have one set of credentials (`defaultUsername`/
   `defaultPassword`), but operators need to track both admin and student
   credentials. Labels should show student credentials, not admin.

## Solution

1. Add a prefix check to the backup delete endpoint and hide the delete
   button in the UI for non-adhoc backups.
2. Add `studentUsername`/`studentPassword` fields to the Computer model.
   Rename existing fields conceptually as admin credentials. Update the
   detail form to show both pairs. Update compact labels to use student
   credentials. Migrate existing data.

## Success Criteria

- Cannot delete daily-* or weekly-* backups via API or UI
- Computer records have both admin and student credential fields
- Computer detail form shows both credential pairs
- Compact labels print student credentials
- Existing computers populated with student/student defaults

## Scope

### In Scope

- Backup delete protection (API + UI)
- New Prisma fields: studentUsername, studentPassword
- Computer detail form update
- Compact label update to use student credentials
- Data migration for existing records

### Out of Scope

- Changing the backup rotation logic itself
- Per-OS credential defaults (future — populate manually for now)

## Test Strategy

- Unit tests for backup delete rejection
- TypeScript compilation verification
- Manual verification of label output and form

## Architecture Notes

- Backup protection: simple filename prefix check in the delete endpoint
- Credentials: additive schema change (new nullable fields), no breaking
  changes to existing API contracts

## Definition of Ready

- [x] Sprint planning documents are complete
- [x] Architecture review passed
- [x] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
