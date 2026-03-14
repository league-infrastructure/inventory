---
id: "005"
title: "Sortable Last Updated Column on Computer List"
status: todo
use-cases:
  - SUC-004
depends-on: []
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Sortable Last Updated Column on Computer List

## Description

Add a sortable "Last Updated" column to the computer list showing each
computer's `updatedAt` timestamp. The `updatedAt` field is already
included in the API response — this ticket adds the frontend column.

Display format: relative date for recent (e.g., "2 hours ago", "3 days
ago") and short date for older (e.g., "Mar 11"). Use the same formatting
approach as other date displays in the app.

The column uses the existing `SortableHeader` component and
`useTableSort` hook, consistent with other sortable columns on the page.

## Files to Modify

- `client/src/pages/computers/ComputerList.tsx` — Add `updatedAt` to
  the `Computer` interface, add "Last Updated" column with
  `SortableHeader`, render formatted date in each row

## Acceptance Criteria

- [ ] "Last Updated" column appears on the computer list
- [ ] Column shows formatted date (relative for recent, short for older)
- [ ] Column is sortable via `SortableHeader` (ascending/descending)
- [ ] Sorting descending puts most recently updated computers at top
- [ ] Column is hidden on mobile (consistent with other secondary columns)
- [ ] `updatedAt` is added to the `Computer` TypeScript interface

## Testing

- **Existing tests to run**: `npm test`
- **New tests to write**: Verify column renders, date formatting works
  for various time ranges
- **Verification command**: `npm test`
