---
status: pending
---

# Sortable "Last Updated" column on kit and computer lists

The kit list and computer list pages should each have a "Last Updated"
column showing when the record was last modified. The column should be
sortable so users can bring the most recently changed records to the top.

"Last updated" means any change to the record — field edits, transfers,
status changes, etc. This likely maps to the Prisma `updatedAt` field
on the Kit and Computer models.

## Scope

- Add `updatedAt` to the kit list API response (if not already included)
- Add `updatedAt` to the computer list API response
- Add a "Last Updated" column to the kit list UI with sort capability
- Add a "Last Updated" column to the computer list UI with sort capability
- Display as a relative or short date format (e.g., "Mar 11" or "2 days ago")
