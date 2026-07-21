---
id: '001'
title: Pack displayNumber data model + shared renumber service
status: done
use-cases:
- SUC-001
- SUC-002
- SUC-003
depends-on: []
github-issue: ''
issue: editable-pack-numbers-on-kit-page.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Pack displayNumber data model + shared renumber service

## Description

Add a persisted, per-kit-unique `displayNumber` to `Pack`, and implement
the shared renumber algorithm as a single `PackService` method. This is
the foundation ticket: it introduces the data model, backfills existing
packs, and provides the one place (`PackService.renumber()`) that both
the REST route (ticket 002) and the MCP tool (ticket 002) will call —
they must not duplicate this logic.

Today `Pack` has no persisted ordering field. The closest existing
concept, `label.service.ts`'s `getPackSequence()`, derives a sequence at
label-print time from `Pack.findMany({ orderBy: { id: 'asc' } })` — it
is not stored, not shown on the kit page, and not editable. This ticket
does **not** touch `label.service.ts` (see sprint's Open Questions —
confirmed out of scope by stakeholder).

## Acceptance Criteria

- [x] `Pack.displayNumber Int` column added via Prisma migration, with
      `@@unique([kitId, displayNumber])` (unique per kit, not global).
- [x] Migration backfills existing packs: nullable add → windowed
      backfill (`ROW_NUMBER() OVER (PARTITION BY "kitId" ORDER BY id
      ASC)`) → `NOT NULL` + unique index, in that order.
- [x] `PackService.renumber(kitId: number, packId: number,
      requestedNumber: number, userId: number): Promise<PackRecord[]>`
      implemented:
  - [x] Validates `requestedNumber` is an integer in `1..N` where N is
        the kit's current pack count; throws `ValidationError`
        otherwise, with **no packs changed**.
  - [x] Validates `packId` belongs to `kitId`; throws `NotFoundError`
        otherwise.
  - [x] Builds an in-memory `(assignedNumber, recencyFlag)` tuple per
        pack: the edited pack gets `(requestedNumber, 0)`; every other
        pack gets `(currentDisplayNumber, 1)`. Sorts ascending by
        `(assignedNumber, recencyFlag)` and assigns `1..N` by walk
        order (edited pack wins ties over the pack that previously held
        the contested number).
  - [x] Persists the result inside one `prisma.$transaction`, using a
        two-phase update: (1) set every pack whose number is changing to
        a unique negative sentinel (`-id`), (2) assign final positive
        `1..N` ranks — so no intermediate row ever collides with
        another under the unique constraint.
  - [x] Writes one `AuditLog` entry (field `displayNumber`, old/new
        value, `source` per caller) for every pack whose number actually
        changed, inside the same transaction — not written for packs
        whose final number equals their prior number.
  - [x] Returns the full, freshly-ordered `PackRecord[]` for the kit
        (sorted by `displayNumber` ascending).
- [x] Stakeholder example A verified: 7-pack kit, edit pack "7" to `4` →
      edited pack = 4, old 4 → 5, old 5 → 6, old 6 → 7 (others
      unchanged).
- [x] Stakeholder example B verified: edit pack "3" to `6` → old pack
      "4" → 3, remainder renumbers continuously.
- [x] `PackService.create()` stamps a valid `displayNumber` (next
      available integer = current pack count + 1) on every new pack —
      required by the new `NOT NULL` constraint.
- [x] `KitService.clone()`'s pack-copy loop stamps `displayNumber` on
      each cloned pack preserving the source kit's relative pack order
      (order source packs by `displayNumber` ascending before copying).
- [x] `PackService.list()`, `PackService.listAll()`, and
      `KitService.get()`'s embedded `packs` query change `orderBy` from
      `name: asc` to `displayNumber: asc`.
- [x] `contracts/pack.ts`: `PackRecord` gains `displayNumber: number`.
- [x] No changes to `label.service.ts` in this ticket (confirmed out of
      scope by stakeholder).
- [x] No changes to `PackService.delete()` in this ticket (no
      delete-time compaction — confirmed out of scope by stakeholder;
      gaps left by deletion are an accepted, documented limitation).

## Testing

- **Existing tests to run**: `tests/server/services/pack-item.service.test.ts`,
  `tests/server/services/kit.service.test.ts` (verify `clone()` and
  ordering changes don't regress existing assertions — note
  `pack-item.service.test.ts`'s `list()` assertion checks pack presence,
  not order, so should be unaffected by the `orderBy` change; re-check
  if it fails).
- **New tests to write** (in a new or extended
  `tests/server/services/` file, following `pack-item.service.test.ts`'s
  `setupTestUser`/`getRegistry`/`getSuffix` conventions):
  - `renumber()` stakeholder example A (7→4).
  - `renumber()` stakeholder example B (3→6).
  - No-op edit: requesting a pack's own current number changes nothing
    and writes no audit rows.
  - Edit to the first position (`1`) and to the last position (`N`).
  - Single-pack kit: requesting `1` is a no-op; requesting anything else
    is a validation error (out of `1..N` range where N=1).
  - Out-of-range request (`0`, negative, or `> N`) throws
    `ValidationError` and leaves all packs unchanged (assert via a
    follow-up `list()` call).
  - After every case: assert the resulting set of `displayNumber`s for
    the kit is exactly `{1, ..., N}` with no gaps or duplicates.
  - `AuditLog` rows: assert one row per changed pack, none for unchanged
    packs, and `field: 'displayNumber'` with correct old/new values.
  - `PackService.create()` assigns the next sequential number to a new
    pack in a kit that already has packs.
  - `KitService.clone()` preserves relative pack order in the cloned
    kit's `displayNumber`s.
- **Verification command**: `cd tests/server && npx jest services/pack-item.service.test.ts services/kit.service.test.ts` plus the new renumber test file (see `tests/server/services/jest.config.js` for the exact invocation pattern used in this repo).
