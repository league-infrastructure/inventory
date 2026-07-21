---
status: done
sprint: '004'
tickets:
- 004-001
- 004-002
---

# Pack numbering follow-ups: delete compaction, label consistency, MCP editability

## Description

Three follow-ups to sprint 003's `Pack.displayNumber` work, promoted from
"deliberately out of scope" to requirements by the stakeholder (2026-07-21).

### 1. Deleting a pack must compact display numbers

Deleting a pack currently leaves a gap in the kit's display numbers until
the next edit. Requirement: when a pack is deleted, the remaining packs in
the kit renumber to a continuous `1..N` **in the same transaction as the
delete**, with audit rows for every pack whose number changes — same
conventions as `PackService.renumber()`.

### 2. Printed labels must use displayNumber

`label.service.ts`'s `getPackSequence()` still derives a pack's label
sequence from `Pack.findMany` ordered by `id ASC`. After any renumber,
printed labels can disagree with the kit page. Requirement: labels render
`kitNumber/displayNumber` — the persisted display number — so the two can
never diverge. Remove the ad hoc sequence derivation.

### 3. MCP pack update path must accept displayNumber

A stakeholder-run agent trying to edit pack numbering via the pack update
tool found `displayNumber` missing from the update fields and nearly
resorted to delete-and-recreate (a data-loss risk). Requirements:

- The `update_pack` MCP tool accepts `displayNumber` and delegates that
  field to `PackService.renumber()` (never a raw column write, which
  would violate the unique/contiguity invariants).
- `PUT /packs/:id` gets the same treatment if consistent with route
  conventions.
- Tool descriptions cross-reference `renumber_pack` so agents discover
  the dedicated tool.

Note: `renumber_pack` (added in sprint 003) exists on local master but is
not deployed; agents talking to the production MCP server won't see it
until a deploy ships `v0.20260721.3` or later.
