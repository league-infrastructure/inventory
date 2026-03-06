---
id: '020'
title: Unified List Views and Inventory Schedule
status: done
branch: sprint/020-unified-list-views-and-inventory-schedule
use-cases: []
---

# Sprint 020: Unified List Views and Inventory Schedule

## Goals

Make kit and computer list views parallel and consistent, with action
buttons per row (transfer, check inventory). Add a configurable
inventory schedule so overdue items surface automatically. Unify search
results with the same list component.

## Problem

Kit and computer lists have different layouts and no inline action
buttons. Users must navigate to detail pages to perform transfers or
inventory checks. There is no system-driven prompt to inventory items
on a schedule — users must manually check dates. Search results don't
offer the same quick actions as list views.

## Solution

1. **Unified list component** — A shared table component used by both
   kit and computer list views with the same column structure and action
   buttons in the last column.
2. **Action buttons per row** — Transfer button (opens transfer modal)
   and Check Inventory button (opens inventory check flow).
3. **Inventory schedule** — Admin-configurable interval (default 60
   days). Items whose `lastInventoried` exceeds the interval show the
   Check Inventory button.
4. **Search integration** — Search results render using the same list
   component with the same action buttons.

## Success Criteria

- Kit and computer list views use the same layout and component.
- Each row has Transfer and Check Inventory action buttons.
- Check Inventory button only appears when the item is overdue per
  the configured schedule.
- Inventory schedule interval is configurable via admin settings.
- Search results use the same list component with action buttons.

## Scope

### In Scope

- Shared list/table component for kits and computers.
- Action buttons (transfer, check inventory) in list rows.
- Admin-configurable inventory schedule interval (Config table).
- Overdue detection logic (backend endpoint or frontend calculation).
- Search results using the shared list component.

### Out of Scope

- Transfer model changes (completed in Sprint 019).
- Import/export changes (Sprint 021).

## Test Strategy

- Frontend component tests for the unified list component.
- Backend tests for inventory schedule configuration and overdue
  detection.
- Integration tests verifying search results render with action buttons.

## Architecture Notes

- Inventory interval stored in the Config table (key: `inventory_interval_days`,
  default: 60).
- Overdue calculation can be done server-side (add an `isOverdue` flag
  to list responses) or client-side (compare `lastInventoried` against
  the configured interval).
- The shared list component accepts a generic item type and renders
  columns + action buttons via configuration.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
