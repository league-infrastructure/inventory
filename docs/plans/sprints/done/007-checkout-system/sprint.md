---
id: '007'
title: Checkout System
status: done
branch: sprint/007-checkout-system
use-cases:
- UC-1.1
- UC-1.2
- UC-1.3
---

# Sprint 007: Checkout System

## Goals

Implement the Kit checkout and check-in flow, including QR-code-triggered
workflows, GPS-based site suggestion, and checkout history tracking.

## Problem

The core operational workflow — instructors taking Kits to teaching sites
and returning them — has no digital tracking. The system needs to record
who has what, where it went, and when it came back.

## Solution

- Check-out flow: scan QR → view Kit status → GPS suggests destination
  site → confirm → checkout recorded.
- Check-in flow: scan QR → detect checked-out Kit → GPS suggests return
  site → confirm → checkout closed.
- Checkout record: Kit, user, destination site, checkout timestamp, return
  site, return timestamp.
- View currently checked-out Kits (all users or filtered by instructor).

## Success Criteria

- Instructor scans a Kit QR code and can check it out with a destination
  site (GPS-suggested or manually selected).
- Instructor scans a checked-out Kit and can check it in.
- The checkout record captures all required fields.
- Checked-out Kits list shows who has each Kit and where.
- Computers assigned to a Kit are implicitly tracked as traveling with it.
- Checkout and check-in are recorded in the audit log.

## Scope

### In Scope

- Kit checkout flow (UC-1.1)
- Kit check-in flow (UC-1.2)
- View currently checked-out Kits (UC-1.3)
- GPS-based site suggestion (browser Geolocation API)
- Checkout model and history
- Mobile-optimized QR scan → action flow
- Audit log entries

### Out of Scope

- Overdue checkout alerts (out of scope for the project)
- Inventory checks during check-in (sprint 007)
- Checkout history report (sprint 011, UC-5.4)

## Test Strategy

- Backend API tests: checkout/check-in endpoints, state transitions,
  concurrent checkout prevention (a Kit can't be checked out twice).
- Database tests: checkout record integrity, foreign key constraints.
- Frontend tests: checkout flow, check-in flow, GPS permission handling,
  checked-out Kits list.
- E2E tests: full checkout → check-in cycle.

## Architecture Notes

- GPS is requested via the browser Geolocation API. The nearest Site is
  calculated server-side by comparing coordinates.
- A Kit can only have one open checkout at a time.
- The QR scan landing page (from sprint 004) is extended to detect checkout
  state and present the appropriate action (check-out vs. check-in).

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
