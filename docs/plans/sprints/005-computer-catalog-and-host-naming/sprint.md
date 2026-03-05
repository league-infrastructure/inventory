---
id: "005"
title: "Computer Catalog and Host Naming"
status: planning
branch: sprint/005-computer-catalog-and-host-naming
use-cases:
  - UC-4.3
  - UC-4.5
  - UC-4.6
---

# Sprint 005: Computer Catalog and Host Naming

## Goals

Implement Computer CRUD with all hardware attributes, disposition tracking
(including repair states), host-name list management, and Computer
assignment to Kits or Sites.

## Problem

Computers are individually tracked assets with serial numbers, service tags,
host names, and lifecycle dispositions. They need their own management
interface separate from the Kit/Pack hierarchy.

## Solution

- Computer CRUD: create, list, view detail, edit. Track serial number,
  service tag, model, default credentials, disposition, date received,
  last inventoried date, notes.
- Disposition states: Active, Loaned, Needs Repair, In Repair, Scrapped,
  Lost, Decommissioned.
- Host-name list: maintain a pool of computer scientist names. Assign
  names to Computers. Show which names are available vs. assigned.
- Computer assignment: assign a Computer to a Kit or directly to a Site.
  A Computer can move between Kits over time.
- QR code generation for Computers.

## Success Criteria

- Quartermaster can create a Computer with all attributes and a host name
  from the pool.
- Disposition changes are tracked in the audit log.
- The host-name list shows available and assigned names.
- A Computer can be assigned to a Kit or a Site, and reassigned later.
- Computer detail view shows full history and current assignment.
- QR code resolves correctly for Computers.

## Scope

### In Scope

- Computer CRUD (UC-4.3)
- All disposition states including Needs Repair and In Repair
- Host-name list management (UC-4.6)
- Computer-to-Kit and Computer-to-Site assignment
- Retire/scrap/decommission flow (UC-4.5)
- QR code generation for Computers
- Audit log entries for all changes

### Out of Scope

- Photo-based computer onboarding (sprint 012)
- Computer inventory verification (sprint 007, UC-2.3)
- Computer labels (sprint 009)

## Test Strategy

- Backend API tests: Computer CRUD, disposition transitions, host-name
  assignment/release, Kit/Site assignment.
- Database tests: disposition enum constraints, host-name uniqueness.
- Frontend tests: Computer form, disposition selector, host-name picker.

## Architecture Notes

- Disposition is an enum in the Prisma schema.
- Host names are stored in a dedicated table with a foreign key to Computer
  (nullable when unassigned).
- When a Computer is assigned to a Kit, it implicitly travels with the Kit
  on checkout.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
