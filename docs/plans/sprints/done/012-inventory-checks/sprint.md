---
id: '012'
title: Inventory Checks
status: done
branch: sprint/012-inventory-checks
use-cases:
- SUC-012-001
- SUC-012-002
- SUC-012-003
- SUC-012-004
---

# Sprint 012: Inventory Checks

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

- Kit inventory check flow (SUC-012-001)
- Pack inventory check flow (SUC-012-002)
- Computer verification (SUC-012-003)
- Discrepancy flagging
- Inventory check history per Kit/Pack (SUC-012-004)
- Mobile-optimized checklist UI

### Out of Scope

- Issue reporting workflow (sprint 013) — discrepancies are flagged but
  not yet managed as issues
- Inventory age report (future)

## Test Strategy

- Backend API tests: inventory check submission, discrepancy creation,
  last-inventoried date update.
- Service tests: start/submit checks, discrepancy flagging, history.
- Frontend tests: checklist UI, quantity input, submission flow.

## Tickets

- 001: Inventory Check Contract and Service
- 002: Inventory Check Routes
- 003: Frontend Inventory Check UI
