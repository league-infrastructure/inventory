---
id: "034"
title: "Compact Issues List and Kit Last Updated Column"
status: active
branch: sprint/034-compact-issues-list-and-kit-last-updated-column
use-cases:
  - SUC-001
  - SUC-002
---

# Sprint 034: Compact Issues List and Kit Last Updated Column

## Goals

1. Redesign the issues list as a compact two-line-per-row table with search
2. Add a sortable "Last Updated" column to the kit list

## Problem

1. Issues list uses card-style layout that wastes vertical space
2. Kit list has no "Last Updated" column for finding recently modified kits

## Solution

1. Replace card layout with compact table rows (two lines per issue) + search input
2. Add `updatedAt` column to kit list using existing SortableHeader pattern

## Success Criteria

- Issues list is visually compact — more issues visible per screen
- Search filters issues by text match
- Kit list has sortable Last Updated column

## Scope

### In Scope

- Issues list redesign to compact two-line rows
- Search input on issues list
- Kit list Last Updated column

### Out of Scope

- Changes to issue data model or API
- Kit list checkbox selection

## Test Strategy

- TypeScript compilation verification
- Manual UX testing

## Architecture Notes

- Frontend-only changes — no backend modifications needed
- Kit list already has `updatedAt` in the interface and API response

## Definition of Ready

- [x] Sprint planning documents are complete
- [x] Architecture review passed
- [x] Stakeholder has approved the sprint plan

## Tickets

1. **#001** — Compact Issues List with Search
2. **#002** — Kit List Last Updated Column
