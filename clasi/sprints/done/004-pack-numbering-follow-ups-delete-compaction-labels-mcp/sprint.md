---
id: '004'
title: 'Pack Numbering Follow-ups: Delete Compaction, Labels, MCP'
status: closed
branch: sprint/004-pack-numbering-follow-ups-delete-compaction-labels-mcp
worktree: false
use-cases:
- SUC-001
- SUC-002
- SUC-003
issues:
- pack-numbering-followups-delete-compaction-labels-mcp.md
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Sprint 004: Pack Numbering Follow-ups: Delete Compaction, Labels, MCP

## Goals

Close three gaps left open by sprint 003's `Pack.displayNumber` work, now
promoted from "deliberately out of scope" / "open question" to
requirements:

1. Deleting a pack compacts the kit's remaining packs to a contiguous
   `1..N` in the same transaction as the delete.
2. Printed labels render the persisted `displayNumber` instead of an
   independently re-derived `id ASC` sequence, so labels and the kit page
   can never disagree.
3. `displayNumber` becomes editable through the general-purpose pack
   update paths (`update_pack` MCP tool, `PUT /packs/:id`) without ever
   bypassing `PackService.renumber()`'s invariants.

## Problem

Sprint 003 gave packs a persisted, unique-per-kit `displayNumber` and a
single shared `PackService.renumber()` method for editing it, exposed via
`PATCH /packs/:id/renumber` and the `renumber_pack` MCP tool. Three gaps
were explicitly deferred at the time:

- `PackService.delete()` does a plain `prisma.pack.delete()` with no
  compaction step, so deleting pack 3 of 5 leaves the kit numbered
  `1, 2, 4, 5` until someone happens to edit a pack and trigger a
  renumber.
- `label.service.ts` never adopted the new field — it still derives a
  pack's printed number from `Pack.findMany({ orderBy: { id: 'asc' } })`,
  independently of `displayNumber`, in three separate places.
- Neither `update_pack` (MCP) nor `PUT /packs/:id` (REST) know about
  `displayNumber` at all; a stakeholder-run agent trying to fix a pack's
  number through the general update tool found the field missing and
  nearly resorted to delete-and-recreate.

## Solution

- `PackService.delete()` wraps the delete, its audit row, and a
  compaction pass over the kit's remaining packs in one
  `prisma.$transaction` — reusing, not re-implementing, the two-phase
  negative-sentinel persistence and per-changed-pack audit convention
  `renumber()` already established. The shared logic is extracted into a
  small private helper both methods call.
- `label.service.ts`'s three ad hoc `id ASC` sequence derivations (one
  named method, two inlined in batch-generation code) are all replaced
  with reads of the persisted `pack.displayNumber`; the now-dead private
  method is deleted.
- `update_pack` (MCP) and `PUT /packs/:id` (REST) both accept an optional
  `displayNumber` field that delegates to `PackService.renumber()` —
  never a raw column write. Tool descriptions cross-reference
  `renumber_pack` so an agent discovers the dedicated tool.

## Success Criteria

- Deleting a pack leaves its kit's remaining packs numbered `1..N` with
  no gaps, verified immediately after the delete (not after a subsequent
  edit), with audit rows for every pack whose number changed as a result.
- `generatePackLabel`, `generateBatchLabels`, and `generateBatchHtml` all
  render `pack.displayNumber`; after a renumber, a freshly generated
  label matches the kit page's number for the same pack.
- `update_pack` accepts `displayNumber` and produces the same final
  pack-numbering outcome as calling `renumber_pack` with the same input;
  it never writes `displayNumber` via a raw column update.
- `PUT /packs/:id` accepts `displayNumber` with the same delegation
  guarantee, returning a single `PackDetailRecord` for the edited pack
  (its existing response contract, unchanged).
- No parallel implementation of the sort/renumber/two-phase-persist
  algorithm exists anywhere in the codebase — `delete()`, `renumber()`,
  `update_pack`, and `PUT /packs/:id` all bottom out in the same
  persistence helper.

## Scope

### In Scope

- `PackService.delete()`: transactional delete + compaction.
- A shared private persistence helper on `PackService`, extracted from
  `renumber()`'s existing two-phase update + audit logic, called by both
  `renumber()` and `delete()`'s compaction step.
- `label.service.ts`: `getPackSequence()` deleted; `generatePackLabel`,
  `generateBatchLabels`, `generateBatchHtml` switched to
  `pack.displayNumber`.
- `contracts/pack.ts`: `UpdatePackInput` gains optional `displayNumber`.
- `server/src/mcp/tools.ts`: `update_pack` tool accepts `displayNumber`,
  delegates to `renumber()`; `update_pack` and `renumber_pack` tool
  descriptions cross-reference each other.
- `server/src/routes/packs.ts`: `PUT /packs/:id` accepts `displayNumber`,
  delegates to `renumber()`, re-fetches and returns the single edited
  pack.

### Out of Scope

- A soft-delete / restore path for packs (packs remain hard-deleted, as
  today — see Architecture's soft/hard-delete finding).
- Retroactively compacting kits whose numbering already has a gap from a
  delete that happened before this sprint ships (see Open Questions).
- Any change to `PATCH /packs/:id/renumber`'s or `renumber_pack`'s
  existing behavior or response shape.
- Drag-and-reorder UI (still out of scope per sprint 003 / the parent
  issue).

## Test Strategy

- **Unit tests** (extend `tests/server/services/pack-renumber.service.test.ts`,
  reusing its `createKitWithPacks` helper): a new
  `describe('PackService.delete() compaction')` block covering: deleting
  a middle pack compacts the remainder to `1..N`; deleting the last pack
  is a no-op for the rest (no audit rows for unaffected packs); deleting
  the first pack shifts everything down by one; audit rows exist for
  every pack whose number changed, source consistent with the calling
  registry (UI/MCP), plus the existing `'deleted'`-field audit row for
  the deleted pack itself; the delete + compaction happen atomically (a
  forced failure mid-compaction leaves the pack un-deleted and all
  numbers unchanged — test via a Prisma-level constraint or mock if a
  real forced failure isn't practical).
- **Unit tests** (extend `tests/server/services/label.service.test.ts`):
  create a kit, add packs, renumber so `id` order and `displayNumber`
  order diverge, then assert each generation path
  (`generatePackLabel`/`generateBatchLabels`/`generateBatchHtml`) renders
  the persisted `displayNumber` rather than the old id-derived sequence —
  for the PDF paths, spy on `PDFDocument.prototype.text` (or equivalent)
  to capture the rendered number string; for `generateBatchHtml`, assert
  directly on the returned HTML string, which is plain inspectable text.
- **Route tests** (extend `tests/server/packs.test.ts`): `DELETE
  /packs/:id` compacts remaining packs (new coverage — no delete tests
  exist today); `PUT /packs/:id` with `displayNumber` produces the same
  renumbered outcome as `PATCH /packs/:id/renumber` for an equivalent
  input, and returns a single `PackDetailRecord` (not an array).
- **MCP tool test** (extend `tests/server/services/mcp-renumber-pack.test.ts`
  or add a sibling file following its fake-server-collector pattern):
  `update_pack` with `displayNumber` produces the same final assignment
  as `renumber_pack` for the same input; `update_pack` without
  `displayNumber` is unaffected (still returns a single pack record).
- Follow existing jest conventions in `tests/server/` (isolated `app`
  test database, hardcoded fallback `DATABASE_URL`). Known baseline: 18
  pre-existing failures across app/auth/github/pike13/integrations/
  issue.service are not this sprint's concern; `inventory-check.service`
  is a known latent flake (ObjectId collision, tracked separately). Full
  suite runs should use `--maxWorkers=2` to converge.

## Architecture

**Substantial** — five files/modules are touched
(`pack.service.ts`, `label.service.ts`, `contracts/pack.ts`,
`mcp/tools.ts`, `routes/packs.ts`) across three nominally independent
follow-ups, crossing the "3+ modules touched" substantial threshold by
module count alone, even though no new cross-module dependency, no
dependency-direction change, and no data-model change occurs (the
`displayNumber` column and its unique constraint already exist from
sprint 003). This mirrors sprint 020's precedent: substantial by module
count, not by new composition. **No diagram is included** — the
component graph sprint 003 already documented (`Client`/`Route`/`Tool` →
`PackService.renumber` → `Audit` → `DB`) is unchanged by this sprint;
what changes is what happens *inside* two of those existing edges
(`delete()` gains a compaction step; `update_pack`/`PUT` gain a new
input field that reaches the same existing `renumber()` edge) and what
`label.service.ts` reads from the DB it already queries. Nothing new is
being composed, so a diagram would repeat sprint 003's without adding
information.

### Architecture Overview

**Responsibilities introduced or changed:**

1. **Delete-time contiguity compaction** — `PackService.delete()` must
   keep the `1..N` invariant true immediately after a delete, not just
   after the next edit.
2. **Shared persistence extraction** — the two-phase negative-sentinel
   write + per-change audit logic, previously inlined in `renumber()`,
   becomes a private helper both `renumber()` and the new compaction step
   call, so the sprint's "no parallel implementation" constraint is
   structural, not just a code-review convention.
3. **Label sequence correctness** — `label.service.ts` stops
   independently deriving a pack's printed number and reads the same
   persisted field the kit page shows.
4. **MCP/REST editability** — `update_pack` and `PUT /packs/:id` become
   additional entry points to the existing `renumber()` method, alongside
   the dedicated `renumber_pack`/`PATCH .../renumber` surfaces.

These group as: (1)+(2) are one concern on `PackService` (both are "how
the display-number invariant is persisted," same owner, same reason to
change together); (3) is independent — `label.service.ts` only reads a
field it doesn't own, and changes for reasons unrelated to how numbers
are assigned; (4) is a thin additive-field change to two existing
registries that already forward every other pack field to `PackService`,
not a new module.

**Modules:**

- **`server/src/services/pack.service.ts` (`PackService`)** — Purpose:
  own all pack data mutations, including keeping `displayNumber`
  contiguous whenever the pack set changes, not only when explicitly
  renumbered. Boundary: unchanged from sprint 003 — takes validated
  input, returns pack record(s), has no knowledge of HTTP or MCP.
  Serves: SUC-001.
- **`server/src/services/label.service.ts` (`LabelService`)** — Purpose:
  render label content using each pack's persisted display number.
  Boundary: read-only consumer of `Pack.displayNumber`; no mutation, no
  knowledge of the renumber algorithm. Serves: SUC-002.
- **`server/src/contracts/pack.ts`** — Purpose: type contract for pack
  inputs/records. Boundary: types only, no behavior. Serves: SUC-003.
- **`server/src/mcp/tools.ts` (`registerTools`)** — Purpose: translate an
  MCP `update_pack` call's `displayNumber` field into a
  `PackService.renumber()` call, identically to `renumber_pack`.
  Boundary: tool schema (zod) and QM-access check only — no algorithm
  logic (unchanged boundary from sprint 003). Serves: SUC-003.
- **`server/src/routes/packs.ts` (`packsRouter`)** — Purpose: translate a
  `PUT /packs/:id` request's `displayNumber` field into a
  `PackService.renumber()` call. Boundary: HTTP concerns only, no
  algorithm logic. Serves: SUC-003.

**Why:**

The delete-compaction requirement is satisfied entirely inside
`PackService.delete()`. Both `DELETE /packs/:id` (REST) and `delete_pack`
(MCP) already call `services.packs.delete(...)` and nothing else — per
sprint 003's shared-service design, neither the route nor the MCP tool
needs a single line changed for requirement 1 to reach both surfaces.
This is the shared-service pattern paying for itself a second time.

**Impact on Existing Components:**

- `PackService.delete()`: signature unchanged (`Promise<void>`), but now
  wraps the delete, its "deleted" audit row, and a compaction pass in one
  `$transaction`, where previously the audit write happened after the
  delete, outside any transaction.
- `PackService.renumber()`: external contract (callers, return shape)
  unchanged; internals refactored to call the new shared private
  persistence helper instead of inlining the two-phase update.
- `PackService.create()`: not modified by this sprint, but benefits as a
  side effect — its `existingPackCount + 1` bootstrap assumes a
  contiguous `1..N` set with no gaps; today a prior delete could leave a
  gap that makes that assumption false (e.g., packs numbered `1,2,4,5`
  after deleting pack 3, where `existingPackCount + 1 = 5` collides with
  the existing pack 5). Once delete always compacts, this latent
  precondition violation can no longer occur.
- `label.service.ts`: `getPackSequence()` deleted; `generatePackLabel`,
  `generateBatchLabels`, `generateBatchHtml` read `displayNumber`
  directly; no public method signatures change.
- `contracts/pack.ts` (`UpdatePackInput`): gains `displayNumber?: number`
  — additive.
- `mcp/tools.ts`: `update_pack`'s schema gains `displayNumber:
  z.number().optional()`; its response shape becomes conditional on
  whether `displayNumber` was supplied (see Design Rationale). Both
  `update_pack` and `renumber_pack`'s description strings are updated.
- `routes/packs.ts`: `PUT /packs/:id` gains a `displayNumber` handling
  branch; `DELETE /packs/:id` requires zero code changes (see Why,
  above).

### Design Rationale

**Decision: extract a shared `persistPackOrder`-style private helper from
`renumber()`, called by both `renumber()` and `delete()`'s compaction
step, rather than inlining a second two-phase update in `delete()`.**
Context: the sprint's constraint is explicit — compaction "must reuse the
same renumber/contiguity machinery... no parallel implementation."
Alternatives considered: (a) duplicate the negative-sentinel two-phase
update inline in `delete()` — rejected, directly violates the
constraint and reintroduces the exact "two implementations of one
invariant" risk sprint 003 centralized `renumber()` to avoid; (b) have
`delete()` call the existing public `renumber()` once per remaining pack
— rejected, `renumber()`'s contract is "one user-driven edit with a
tie-break for the edited pack," which has no meaning for closing a gap
left by a deletion, and calling it repeatedly against a shrinking `N`
is both wasteful and semantically wrong.
Chosen: a private helper that takes the kit's current packs and an
already-decided target order (pack ids in their final `1..N` sequence),
and performs the transactional diff, two-phase negative-then-positive
write, and per-change audit rows. `renumber()` computes the target order
via its existing sort-with-tie-break algorithm; `delete()`'s compaction
step computes it trivially (remaining packs, re-ranked without the
gap). Both call the same helper.
Consequence: the two-phase technique and the audit convention have
exactly one implementation on `PackService`; a future change to either
cannot silently diverge between the edit path and the delete path.

**Decision: packs remain hard-deleted; no soft-delete/`deletedAt` is
added for `Pack`, and compaction runs unconditionally on every delete.**
Context: the sprint's constraint anticipated a possible soft-delete
pattern for packs (parallel to Kit/Manufacturer/Computer) that would
require compaction to filter to "live" packs and raise a
restore-collision question.
Finding: schema inspection confirms only `Kit`, `Manufacturer`, and
`Computer` carry a `deletedAt` column — `Pack` does not.
`PackService.delete()` calls `prisma.pack.delete()` (an unconditional
hard delete; `Item.packId` cascades via `onDelete: Cascade` at the DB
level). No `PackService.restore()` exists anywhere in the codebase —
only `KitService.restore()`, for the soft-deleted Kit/Computer family.
Consequence: no "live packs only" filter is needed (a deleted pack's row
is simply gone from the table), and there is no restore-collision
scenario to design for — compaction only ever needs
`prisma.pack.findMany({ where: { kitId } })` read after the delete,
which already reflects only the surviving packs. This closes sprint
003's Open Question 1 without introducing a new soft-delete mechanism
for packs, which was neither requested nor needed.

**Decision: the delete, its "deleted" audit row, and the compaction pass
commit as one `prisma.$transaction`.**
Context: requirement 1 explicitly demands "in the same transaction as
the delete."
Consequence: if compaction fails partway, the delete itself rolls back —
a pack is never left deleted with its kit's numbering inconsistent,
matching the "no partial state is ever observable" invariant sprint 003
established for `renumber()`. The existing "deleted" audit write (today
issued after the delete, outside any transaction) moves inside the
transaction as part of this change.

**Decision: all three of `label.service.ts`'s ad hoc `id ASC` sequence
derivations are replaced, not just the one the issue names
(`getPackSequence`); the now-dead method is deleted rather than left
unused.**
Context: the issue names `getPackSequence()` specifically. Investigation
found the identical pattern — order packs by `id ASC`, then
`findIndex(...) + 1` — independently inlined in two other methods that
never call `getPackSequence`: `generateBatchLabels()` and
`generateBatchHtml()`.
Alternatives considered: fix only `getPackSequence()` per the issue's
literal wording — rejected; that would leave the batch-print paths
(arguably the more common print workflow — printing several labels at
once) still diverging from the kit page after any renumber, defeating
the requirement's stated goal for two of the three label-rendering entry
points.
Chosen: every pack-number render in `label.service.ts` reads
`pack.displayNumber` — already present on the default scalar selection
for `generatePackLabel`'s single-pack fetch; added to the `select` for
the two batch queries (whose `orderBy` also moves from `id: 'asc'` to
`displayNumber: 'asc'`, for print order that matches the kit page).
`getPackSequence()` is deleted outright, since a private method with no
remaining callers is exactly the kind of dead code that reintroduces
this drift the next time someone adds a caller without noticing the
persisted field already exists.
Consequence: `generateBatchLabels`/`generateBatchHtml`'s `kit.packs`
query and the `findIndex`+1 computation both change; no public method
signature changes.

**Decision: `update_pack` (MCP) gains `displayNumber` and delegates to
`renumber()`; when `displayNumber` is present, its response mirrors
`renumber_pack`'s full renumbered-list shape rather than a single pack
record.**
Context: requirement 3 is unconditional for the MCP tool.
Alternatives considered: always return a single `PackDetailRecord`
regardless of which fields were edited, for a uniform tool contract —
rejected; an agent editing `displayNumber` needs to see every pack whose
number shifted, which is the entire point of `renumber_pack`'s existing
response shape — silently returning only the edited pack would let an
agent believe no other pack changed when several may have.
Chosen: `update_pack` applies any `name`/`description` change via the
existing `update()` call first (unchanged), then — only if
`displayNumber` is present — calls `renumber()` and returns its full-list
result. Tool descriptions are updated: `update_pack`'s description
states this behavior and points to `renumber_pack` for dedicated
renumber calls; `renumber_pack`'s description gains one added line
noting `update_pack` also accepts `displayNumber` for combined edits.
Consequence: `update_pack`'s response shape is conditional on its input —
acceptable for an MCP tool consumed by an AI agent parsing JSON (not a
typed frontend client), and this exact asymmetry already exists across
`PUT /packs/:id` vs. `PATCH /packs/:id/renumber` today.

**Decision: `PUT /packs/:id` gains an optional `displayNumber` but keeps
its existing single-`PackDetailRecord` response shape — it does not
switch to the full kit-pack-array shape `PATCH /packs/:id/renumber`
returns.**
Context: sprint 003 explicitly rejected folding `displayNumber` into
`PUT /packs/:id` for the original feature, specifically because the
renumber response (the whole kit's freshly-ordered pack list) is
shape-incompatible with `PUT`'s single-record response. That rationale
still holds and is not being overridden here — this decision extends
`PUT` additively without touching it.
Alternatives considered: switch `PUT`'s response to the full array
whenever `displayNumber` is present, mirroring `update_pack` — rejected;
`PUT /packs/:id` is a typed REST contract with an established
single-record response, and the kit page's UI already exclusively uses
the dedicated `PATCH .../renumber` endpoint for number edits (per sprint
003) and never calls `PUT` for this — conditionally changing `PUT`'s
shape would be a breaking-change risk for any other caller assuming
`PUT` always returns one pack.
Chosen: if `displayNumber` is present in the `PUT` body, the route
delegates to `services.packs.renumber(pack.kitId, id, displayNumber,
user.id)` — never a raw column write — then re-fetches and returns
`services.packs.get(id)`: a single `PackDetailRecord` for the edited
pack, reflecting its own new number. Other packs in the kit may shift as
a side effect, exactly as `renumber_pack`'s description already warns
for the MCP path; a caller needing the full shifted set still uses
`PATCH /packs/:id/renumber`.
Consequence: `PUT /packs/:id`'s response contract is unchanged (always
one `PackDetailRecord`). A REST caller that sets `displayNumber` via
`PUT` and doesn't separately re-fetch the kit will not see other packs'
shifted numbers in that single response — called out explicitly in the
ticket's acceptance criteria so it isn't rediscovered as a surprise
later.

### Migration Concerns

- **No schema change**: `displayNumber` and its `@@unique([kitId,
  displayNumber])` constraint already exist from sprint 003. This sprint
  changes service internals, an MCP tool schema (additive optional
  field), a REST route body (additive optional field), and a
  label-rendering data source — no migration is needed.
- **Deployment sequencing**: none required beyond a normal deploy; no
  expand/contract window applies.
- **Backward compatibility**: `UpdatePackInput.displayNumber` and the
  MCP `update_pack` `displayNumber` param are additive/optional —
  existing callers that omit them see no behavior change. `PUT
  /packs/:id`'s response shape is unchanged. Removing `getPackSequence()`
  is safe: it has zero remaining callers once this sprint's own changes
  land in the same deploy.
- **No retroactive backfill**: a kit whose numbering already has a gap
  from a delete that happened before this sprint ships is not
  automatically compacted by deploying this sprint — compaction only
  triggers going forward, on the next delete or edit for that kit. See
  Open Questions.

## Use Cases

### SUC-001: Deleting a pack compacts the kit's remaining display numbers
Parent: UC-009

- **Actor**: Quartermaster (via the kit page) or an MCP-connected client,
  deleting a pack.
- **Preconditions**: A kit has N packs numbered `1..N` with no gaps.
- **Main Flow**:
  1. Actor deletes a pack (`DELETE /packs/:id` or the `delete_pack` MCP
     tool — both already call `PackService.delete()`).
  2. In the same transaction as the delete: the deleted pack's row and
     its "deleted" audit entry are written, and every remaining pack in
     the kit is re-ranked to a contiguous `1..N` with no gap where the
     deleted pack's number used to be.
  3. Audit rows are written for every remaining pack whose number
     actually changed as a result.
- **Postconditions**: The kit's remaining `N-1` packs are numbered `1..N-1`
  with no gaps, immediately after the delete — not after a subsequent
  edit.
- **Acceptance Criteria**:
  - [ ] Deleting a middle pack (e.g., pack 3 of 5) results in the
        remaining packs numbered `1, 2, 3, 4` with no gap at the old
        position.
  - [ ] Deleting the last pack (highest number) changes no other pack's
        number and writes no audit rows for unaffected packs.
  - [ ] Deleting the first pack shifts every remaining pack down by one.
  - [ ] The delete and the compaction commit atomically — no
        intermediate state (deleted pack gone, but numbering not yet
        compacted) is ever observable.
  - [ ] `AuditLog` rows exist for the deleted pack (`field: 'deleted'`)
        and for every pack whose `displayNumber` changed, with `source`
        matching how the delete was made (UI or MCP).

### SUC-002: Printed labels always match the kit page's display number
Parent: UC-009

- **Actor**: Quartermaster printing pack labels (single or batch, PDF or
  HTML).
- **Preconditions**: A kit's packs have been renumbered at least once
  (so `id` order and `displayNumber` order differ).
- **Main Flow**:
  1. Actor generates a pack label via `generatePackLabel`, or a batch via
     `generateBatchLabels`/`generateBatchHtml`.
  2. Each rendered label shows the pack's persisted `displayNumber`, not
     a number re-derived from `id` order.
- **Postconditions**: A freshly printed label for a given pack always
  shows the same number the kit page currently shows for that pack.
- **Acceptance Criteria**:
  - [ ] `generatePackLabel` renders `${kit.number}/${pack.displayNumber}`.
  - [ ] `generateBatchLabels` renders each selected pack's
        `displayNumber`, not an `id`-order-derived index.
  - [ ] `generateBatchHtml` renders each selected pack's `displayNumber`,
        not an `id`-order-derived index.
  - [ ] `getPackSequence()` no longer exists in `label.service.ts`.

### SUC-003: MCP/REST clients edit a pack's display number without a raw column write
Parent: UC-009

- **Actor**: An MCP-connected client (e.g., an AI assistant) or a REST
  API caller, with Quartermaster access.
- **Preconditions**: Same as sprint 003's SUC-002/SUC-003.
- **Main Flow**:
  1. Client calls `update_pack` (MCP) or `PUT /packs/:id` (REST) with a
     `displayNumber` field, optionally alongside `name`/`description`.
  2. Any `name`/`description` change is applied via the existing
     `update()` path; the `displayNumber` change is applied by delegating
     to `PackService.renumber()` — never a raw column write.
  3. `update_pack`'s response, when `displayNumber` was included, is the
     full renumbered kit pack list (identical to calling `renumber_pack`
     with the same input). `PUT /packs/:id`'s response remains a single
     `PackDetailRecord` for the edited pack.
- **Postconditions**: Renumbering via `update_pack` or `PUT /packs/:id`
  produces the same final `1..N` assignment as the equivalent
  `renumber_pack`/`PATCH .../renumber` call for the same starting state
  and input.
- **Acceptance Criteria**:
  - [ ] `update_pack`'s schema accepts an optional `displayNumber`.
  - [ ] Given the same starting numbers and the same requested number,
        `update_pack` and `renumber_pack` produce the same final `1..N`
        assignment.
  - [ ] `update_pack`'s tool description states its `displayNumber`
        behavior and cross-references `renumber_pack`; `renumber_pack`'s
        description is updated to note `update_pack` also accepts
        `displayNumber`.
  - [ ] `PUT /packs/:id` accepts an optional `displayNumber`, delegates to
        `renumber()`, and returns a single `PackDetailRecord` reflecting
        the edited pack's new number.
  - [ ] Neither `update_pack` nor `PUT /packs/:id` ever writes
        `displayNumber` via a raw `prisma.pack.update({ data: {
        displayNumber } })` call outside `renumber()`.

## GitHub Issues

(No GitHub issues linked to this sprint's tickets.)

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [x] Sprint planning document is complete (sprint.md, including its
      Architecture and Use Cases sections)
- [ ] Architecture review passed (or skipped, for changes with no
      architectural impact)
- [ ] Stakeholder has approved the sprint plan

## Open Questions

None block writing the tickets; recommendations are given so the
stakeholder's delegated defaults apply unless overridden:

1. **Retroactive backfill for existing gaps**: kits that already have a
   numbering gap from a delete that happened before this sprint ships
   are not touched by this sprint — they self-heal the next time someone
   deletes or edits a pack in that kit. Recommendation if no preference:
   no backfill script; the self-healing behavior is sufficient and a
   one-off script adds risk for a cosmetic, self-correcting gap.
2. **`PUT /packs/:id` response-shape asymmetry**: a REST caller that sets
   `displayNumber` via `PUT` sees only the one edited pack in the
   response, even though other packs in the kit may have shifted.
   Recommendation if no preference: accept this as documented behavior
   (matches the existing `renumber_pack` MCP UX, and the kit page never
   calls `PUT` for numbering) rather than changing `PUT`'s response
   shape.

## Tickets

| # | Title | Depends On |
|---|-------|------------|
| 001 | Delete-time compaction + shared renumber helper + label displayNumber switch | — |
| 002 | update_pack MCP + PUT /packs/:id displayNumber wiring | 001 |

Tickets execute serially in the order listed.
