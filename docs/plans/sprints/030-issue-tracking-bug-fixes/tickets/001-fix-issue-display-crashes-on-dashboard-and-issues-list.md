---
id: "001"
title: "Fix issue display crashes on dashboard and issues list"
status: todo
use-cases: []
depends-on: []
---

# Fix issue display crashes on dashboard and issues list

## Description

Two components crash when displaying issues that only reference a kit
or computer (no pack/item):

1. **`Landing.tsx` OpenIssuesWidget** — Defines a local `IssueRecord`
   interface with `packName`/`itemName`/`description` fields that don't
   match the API contract (`pack: { id, name } | null`). When `pack` is
   null, accessing `.name` crashes.

2. **`IssueList.tsx`** — Accesses `issue.item.name` and `issue.pack.name`
   without null checks. Same crash on kit/computer-only issues.

### Changes needed

- `Landing.tsx`: Replace the stale local `IssueRecord` interface with
  the correct API shape. Add null-safe access for `pack`, `item`, `kit`,
  and `computer`. Display whichever target entity is present.
- `IssueList.tsx`: Add null checks for `pack`, `item`, `kit`, `computer`.
  Display the appropriate target (kit name, computer hostname, pack/item).

## Acceptance Criteria

- [ ] Dashboard loads without error when issues exist (including kit/computer-only)
- [ ] OpenIssuesWidget displays kit name or computer name for non-pack issues
- [ ] Issues list page renders all issue types without crashing
- [ ] Issues list shows the correct target entity for each issue type

## Testing

- **Existing tests to run**: `npm run test:server`
- **Verification command**: Visual verification on dashboard and issues page
