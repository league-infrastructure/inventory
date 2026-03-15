---
status: pending
---

# Sortable "Last Updated" column on kit list

Add a sortable "Last Updated" column to the kit list page, matching
the one already implemented on the computer list (sprint 032).

## Scope

- Add `updatedAt` to the kit list API response (if not already included)
- Add a "Last Updated" column to the kit list UI with sort capability
- Display as relative time for recent ("2h ago") or short date for older
  ("Mar 11"), same format as the computer list
- Use existing `SortableHeader` component and `useTableSort` hook
- Hidden on mobile, consistent with other secondary columns
