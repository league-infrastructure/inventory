---
id: '011'
title: Inventory Checks
status: planning
branch: sprint/011-inventory-checks
use-cases:
- UC-2.1
- UC-2.2
- UC-2.3
---

# Sprint 011: Inventory Checks

## Goals

Implement QR-scan-driven inventory verification for Kits, Packs, and
Computers, with discrepancy flagging.

## Problem

There is no way to verify that a Kit actually contains what it's supposed
to contain. Instructors need a fast, mobile-friendly way to check off
items and flag anything missing.

## Solution

- Kit inventory check: scan QR → see checklist of all Packs, their Items,
  and assigned Computers → tap present/absent → submit.
- Pack inventory check: scan QR → see checklist of Items in that Pack →
  tap present/absent → submit.
- Computer verification: scan QR → confirm present at expected location →
  update "last inventoried" date.
- Discrepancy records: when items are marked absent or counts are wrong,
  create a discrepancy record linked to the inventory check.

## Success Criteria

- Instructor scans a Kit QR and sees a complete checklist of contents.
- Counted items show expected quantity; instructor confirms or enters
  actual count.
- Consumables show as present/absent toggle.
- Submission records the check with user and timestamp.
- Discrepancies are flagged and visible to quartermasters.
- Computer verification updates the "last inventoried" date.
- All actions recorded in audit log.

## Scope

### In Scope

- Kit inventory check flow (UC-2.1)
- Pack inventory check flow (UC-2.2)
- Computer verification (UC-2.3)
- Discrepancy flagging
- Inventory check history per Kit/Pack/Computer
- Mobile-optimized checklist UI

### Out of Scope

- Issue reporting workflow (sprint 008) — discrepancies are flagged but
  not yet managed as issues
- Inventory age report (sprint 011)

## Test Strategy

- Backend API tests: inventory check submission, discrepancy creation,
  last-inventoried date update.
- Database tests: inventory check records, discrepancy linkage.
- Frontend tests: checklist UI, quantity input, submission flow.

## Architecture Notes

- An inventory check is a record with a timestamp, user, and a set of
  line items (one per Item/Computer in the Kit/Pack).
- Each line item records: expected value, actual value, and a discrepancy
  flag.
- The checklist is generated from the Kit/Pack's current manifest at check
  time.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
