---
id: '026'
title: Miscellaneous Bug Fixes
status: done
branch: sprint/026-miscellaneous-bug-fixes
use-cases: []
---

# Sprint 026: Miscellaneous Bug Fixes

## Goals

Address accumulated bug fixes, logging improvements, and small UI
enhancements from production usage. This is an open-ended sprint for
clearing the TODO backlog.

## Problem

Several issues identified during production deployment and daily use:
- HTTP 500 errors are logged at INFO level, making them invisible in logs
- Audit log doesn't distinguish between UI, MCP, and Slack action sources
- Dashboard "Transferred Out" section isn't useful; should show recent
  custody changes with full context

## Solution

Fix each issue as an independent ticket. All are small, self-contained
changes.

## Success Criteria

- 500 errors logged at ERROR level
- Audit log entries tagged with source (ui/mcp/slack)
- Dashboard shows recent custody changes with who/to-whom/where/when

## Scope

### In Scope

- Logging level fix for 5xx responses
- Audit log source tagging
- Dashboard custody changes widget
- Any additional small bugs found during the sprint

### Out of Scope

- New features or major refactors
- Database schema changes beyond what's needed for source tagging

## Test Strategy

Each fix gets targeted tests at the appropriate layer (server unit tests
for logging, API tests for audit source tagging, component tests for
dashboard widget).

## Architecture Notes

All changes are localized — no cross-cutting architectural impact.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
