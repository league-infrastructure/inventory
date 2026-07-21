---
status: in-progress
sprint: '003'
tickets:
- 003-001
- 003-002
- 003-003
---

# Editable, sortable pack numbers on the kit page

On a kit's page there is a list of the packs belonging to that kit.
Each pack has a **database pack number** (the identifier the database
uses), but there is also a separate **display number** — the number a
user thinks of as "pack 1, pack 2, pack 3…". That display number is
currently **not shown anywhere on this page**.

## Requirements

### 1. Show the display number

Render each pack's display number in the pack list on the kit page.

### 2. Make the display number inline-editable

Click the display number to edit it in place, and save the new value.

### 3. Collision resolution: the edited pack wins, then renumber

When the user changes a pack's number to a value another pack already
holds, the **just-edited pack keeps the (smaller) contested number**;
the pack that previously held it — and everything after — shifts up by
one. The whole list is then renumbered into a continuous `1..N`
sequence with **no gaps and no duplicates**.

Examples given by the stakeholder:

- **A — move up:** renumber pack `7 -> 4`. Pack 7 takes `4`, the old
  `4` becomes `5`, and everything after shifts sequentially.
- **B — move down:** renumber pack `3 -> 6`. The old pack `4` becomes
  `3`, and the list is re-sorted so numbering stays continuous.

### 4. Algorithm (stakeholder's framing)

Treat it as a single sort + renumber, not a special-cased shuffle:

1. Sort all packs. The sort key is `(assigned_number,
   recency_of_change)` — i.e. when two packs share a number, the one
   the user **just changed** sorts *first* and the previously-existing
   one sorts *second*.
2. Walk the sorted list and assign `1..N` from the top.

( you dont need to use actual times for `recency_of_change`. Just initialize the values to 1, then set the one you just changed to 0. We are never changing more than one per sort. )

So editing pack 7 to "4" produces two packs numbered 4; the just-edited
one wins the tie and lands at position 4, the former 4 falls to 5, and
the sequential renumber cascades from there.

### 5. MCP server must also be able to renumber packs

The renumber operation must be exposed as an MCP tool / server
capability, not only wired into the web UI. Both the web UI and the
MCP server should drive the **same** renumber logic (shared
service/function) so behavior can't diverge.

## Open questions / notes for planning

- Confirm the data model: where the display number lives today (a
  column on the pack row? derived?), and where the "recency of change"
  signal comes from (an `updated_at`, an explicit ordering column, or
  a new field to add).
- Decide the persistence unit: does a single edit persist the whole
  renumbered set (transactional), so the `1..N` invariant is never
  violated mid-write?
- UI affordance for edit (click-to-edit input vs. drag-to-reorder is
  out of scope here — this issue is number-entry driven).
