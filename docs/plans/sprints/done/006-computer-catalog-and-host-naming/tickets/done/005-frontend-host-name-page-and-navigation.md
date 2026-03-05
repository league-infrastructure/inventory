---
id: '005'
title: Frontend Host Name page and navigation
status: done
use-cases:
- SUC-004
depends-on:
- '002'
---

# Frontend Host Name page and navigation

## Description

Create a HostNameList page showing all host names with their assignment
status. Include an "Add Host Name" form and delete button for unassigned
names. Add route to App.tsx and navigation from Computer list.

## Acceptance Criteria

- [x] `HostNameList.tsx` shows all host names in a table
- [x] Table columns: Name, Status (Available/Assigned), Assigned Computer (link if assigned)
- [x] "Add Host Name" form with text input and submit button
- [x] Duplicate name shows error message
- [x] Delete button on unassigned names; assigned names show no delete
- [x] App.tsx route: `/hostnames`
- [x] Computer list page includes link to "Manage Host Names"

## Testing

- **Existing tests to run**: `cd client && npx tsc --noEmit`
- **New tests to write**: None (client test framework not yet set up — Vitest + RTL are planned but not installed)
- **Verification command**: `cd client && npx tsc --noEmit`
