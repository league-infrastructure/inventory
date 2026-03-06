---
id: 019
title: Transfer and Custodian Model
status: done
branch: sprint/019-transfer-and-custodian-model
use-cases: []
---

# Sprint 019: Transfer and Custodian Model

## Goals

Replace the checkout/checkin model with a "transfer" concept backed by
a custodian + site pair on kits and computers. Build the essential UI
(transfer modal, buttons on lists and detail pages) so the new model
is immediately usable.

## Problem

The current checkout/checkin model is limited: it only tracks who took
a kit and where. It doesn't capture the broader concept of custody —
who is responsible for an item and where it physically is. Computers
cannot be checked out independently in a meaningful way. There is no
chain-of-custody audit trail distinct from field edits.

## Solution

1. **Custodian field** — Add a custodianId (nullable User FK) to Kit
   and Computer. Null means admin custody (storeroom). A user ID means
   that person is responsible.
2. **Transfer operation** — A dedicated operation that changes custodian
   and/or site, recorded as a chain-of-custody audit event (not a
   regular field edit). Replaces checkout/checkin.
3. **Kit-computer cascade** — When a kit is transferred, its site and
   custodian cascade to all computers in the kit.
4. **Transfer UI** — A modal for setting new custodian and/or site,
   accessible from list rows and detail pages. The "Checked Out" page
   becomes a "Transferred Out" page showing both kits and computers.
5. **Remove Checkout/ComputerCheckout models** — Replace with the
   transfer model.

## Success Criteria

- Kits and computers have custodian and site fields.
- Transfer operation changes custodian/site and creates a chain-of-custody
  audit entry.
- Kit transfers cascade to computers in the kit.
- Transfer modal works from list rows and detail pages.
- "Checked Out" page shows transferred kits and computers.
- Old Checkout and ComputerCheckout models are removed.
- All existing tests pass; new tests cover transfer logic.

## Scope

### In Scope

- Schema migration: add custodianId to Kit and Computer, remove Checkout
  and ComputerCheckout models.
- Transfer service with chain-of-custody audit logging.
- Transfer API routes and MCP tools.
- Transfer modal component (custodian + site selection).
- Transfer button on kit/computer list rows and detail pages.
- Updated "Checked Out" → "Transferred Out" page with both kits and
  computers.
- Data migration: convert existing checkout records to initial transfer
  state.

### Out of Scope

- Unified list view redesign (Sprint 020).
- Inventory schedule and check inventory button (Sprint 020).
- Import/export changes (Sprint 021).

## Test Strategy

- Database tests for transfer cascade (kit → computers).
- Service tests for transfer validation, audit logging.
- API tests for transfer routes.
- Frontend component tests for transfer modal.

## Architecture Notes

- Custodian is null for admin custody, a User ID for personal custody.
- Transfer is a separate audit source/type, not a field edit.
- When a computer is in a kit, its site and custodian are always synced
  with the kit's. Direct transfer of a computer in a kit is not allowed.
- Computers not in a kit can be transferred independently.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
