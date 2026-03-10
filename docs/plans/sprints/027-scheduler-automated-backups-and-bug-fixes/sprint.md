---
id: "027"
title: "Scheduler, Automated Backups, and Bug Fixes"
status: planning
branch: sprint/027-scheduler-automated-backups-and-bug-fixes
use-cases: [SUC-001, SUC-002, SUC-003, SUC-004, SUC-005]
---

# Sprint 027: Scheduler, Automated Backups, and Bug Fixes

## Goals

1. Build a lightweight internal job scheduler with a tick-based execution
   model and request-piggyback trigger.
2. Implement automated daily and weekly database backup rotation using the
   scheduler, with retention policies and S3 storage.
3. Add immediate acknowledgment for Slack AI chat messages so long-running
   requests don't appear locked up.
4. Fix the MCP kit category update bug.

## Problem

The system has no way to run periodic tasks. Database backups are manual-only
(admin button), with no automated rotation or retention policy. When users
send long messages through Slack, they get no feedback until processing
completes, making the system appear unresponsive. The MCP `update_kit` tool
frequently fails to apply category changes.

## Solution

- **Scheduler:** A `ScheduledJob` database table tracks jobs with frequency,
  last/next run times, and error state. A `GET /api/scheduler/tick` route
  checks for due jobs and executes them with row-level locking
  (`FOR UPDATE SKIP LOCKED`). A lightweight middleware piggybacks on incoming
  requests to trigger the tick at configurable intervals.
- **Backup rotation:** Two scheduled jobs — daily and weekly — that call the
  existing `BackupService.createBackup()` with new naming conventions and
  delete stale backups per retention policy (6 daily, 4 weekly). Manual
  backups (admin button) are never auto-deleted.
- **Slack receipt:** Send an immediate "working on it" message to the user
  before invoking `AiChatService`, then post the full response when done.
- **MCP category fix:** Investigate and fix `categoryId` handling in the
  `update_kit` MCP tool. Add `categoryId` to the audit fields.

## Success Criteria

- Scheduler tick correctly identifies and runs due jobs with no double
  execution under concurrent requests.
- Daily backups rotate with 6-file retention; weekly backups rotate with
  4-file retention. Manual backups are unaffected.
- Slack users see an immediate acknowledgment within seconds of sending a
  message, followed by the full AI response.
- MCP `update_kit` reliably updates kit category.

## Scope

### In Scope

- `ScheduledJob` Prisma model and migration
- Scheduler service (tick logic, locking, error capture)
- Scheduler route (`GET /api/scheduler/tick`)
- Scheduler trigger middleware (request piggyback)
- Backup rotation service (naming, retention, daily/weekly jobs)
- Seed the two backup jobs in the migration
- Slack immediate receipt for AI chat messages
- MCP kit category bug fix and audit field addition
- Admin UI: scheduled jobs viewer (list jobs, see last error, next run)

### Out of Scope

- External cron integration (future enhancement)
- Backup encryption
- Backup restore from S3 (already exists for local files)
- Full inventory check workflow overhaul

## Test Strategy

- **Database tests:** Verify ScheduledJob migration, row-level locking
  behavior with concurrent transactions.
- **Server tests:** Scheduler tick route (due jobs execute, locked jobs
  skipped, errors captured). Backup rotation (correct files created/deleted,
  naming convention, retention limits). MCP category update fix.
- **Client tests:** Scheduled jobs admin panel renders correctly.
- **Manual testing:** Slack receipt behavior (send long message, verify
  immediate acknowledgment).

## Architecture Notes

This sprint introduces a new Scheduler module (service, route, middleware,
database table) and extends the Backup module with rotation logic. These are
architectural changes requiring architecture-002.

## Tickets

(To be created after sprint approval.)
