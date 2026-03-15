---
status: pending
---

# Compact issues list with search

The issues list currently takes up too much vertical space. Redesign it
as a compact, spreadsheet-style two-line-per-row format with search.

## Layout

Each issue should be two lines:
- **Line 1**: Status badge, issue type, object name/link, reporter, date
- **Line 2**: Description/notes text (truncated if long)

This is denser than the current card-style layout but still readable.

## Search

Add a text search input at the top of the issues list that filters
issues by matching against:
- Object name (kit, pack, computer)
- Description/notes text
- Reporter name
- Issue type

## Scope

- Redesign the issues list page to use the compact two-line format
- Add search/filter input
- Keep existing sort and filter-by-status capabilities
- Responsive — works on mobile with graceful column hiding
