---
id: '015'
title: Reporting, Search, and Audit Log
status: planning
branch: sprint/015-reporting-search-and-audit-log
use-cases:
- UC-5.1
- UC-5.2
- UC-5.3
- UC-5.4
- UC-5.5
- UC-5.6
- UC-5.7
- UC-5.8
- UC-6.1
---

# Sprint 015: Reporting, Search, and Audit Log

## Goals

Implement all report views, global search, the audit log query interface,
and user activity history.

## Problem

The system has been accumulating data across Kits, Computers, checkouts,
inventory checks, and issues for several sprints. Users need structured
ways to query and visualize this data.

## Solution

- Seven report views plus user activity history (UC-5.1 through UC-5.8).
- Global search across all object types (UC-6.1).
- Audit log query interface with filters by object, user, date range,
  and field changed.

## Success Criteria

- All eight reports render correctly with real data.
- Global search returns results grouped by object type.
- Search matches against: Kit name/ID, Pack name/ID, Item name, Computer
  host name/serial/service tag/model, Site name.
- Audit log query supports filtering and pagination.
- User activity history shows all actions by a specific user.

## Scope

### In Scope

- Kit detail report (UC-5.1)
- Computer detail report (UC-5.2)
- Checked-out items by person (UC-5.3)
- Checkout history for a Kit (UC-5.4)
- Open issues report (UC-5.5)
- Inventory age report (UC-5.6)
- Audit log query (UC-5.7)
- User activity history (UC-5.8)
- Global search (UC-6.1)

### Out of Scope

- Report export to PDF (could be added later)
- Scheduled/automated reports

## Test Strategy

- Backend API tests: each report endpoint with test data, search endpoint
  with various queries, audit log query with filters.
- Database tests: query performance with representative data volumes.
- Frontend tests: report rendering, search input and results display,
  audit log filter UI.

## Architecture Notes

- Reports are server-rendered API endpoints returning JSON; the frontend
  renders the views.
- Global search uses PostgreSQL full-text search or ILIKE queries across
  relevant columns.
- Audit log queries should be paginated — the log can grow large.
- Consider database indexes for search and report performance.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
