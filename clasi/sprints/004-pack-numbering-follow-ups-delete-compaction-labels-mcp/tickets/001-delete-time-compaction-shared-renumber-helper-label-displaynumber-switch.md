---
id: '001'
title: Delete-time compaction + shared renumber helper + label displayNumber switch
status: open
use-cases:
- SUC-001
- SUC-002
depends-on: []
github-issue: ''
issue: pack-numbering-followups-delete-compaction-labels-mcp.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Delete-time compaction + shared renumber helper + label displayNumber switch

## Description

Two related fixes to `server/src/services/pack.service.ts` and
`server/src/services/label.service.ts`:

1. `PackService.delete()` currently does a plain `prisma.pack.delete()`
   with no compaction step, leaving a numbering gap in the kit until a
   later edit happens to trigger a renumber. It must instead compact the
   kit's remaining packs to a contiguous `1..N` in the **same
   transaction** as the delete, with audit rows for every pack whose
   number changes.
2. `label.service.ts` derives a pack's printed number from
   `Pack.findMany({ orderBy: { id: 'asc' } })` in **three** separate
   places — the named `getPackSequence()` method, and inline
   `findIndex(...) + 1` logic duplicated in `generateBatchLabels()` and
   `generateBatchHtml()` — none of which read the persisted
   `displayNumber`. All three must switch to `pack.displayNumber` so
   printed labels can never disagree with the kit page.

These two fixes are grouped in one ticket because the compaction fix
requires extracting `renumber()`'s existing two-phase negative-sentinel
persistence logic into a shared private helper on `PackService` — see
sprint.md's Architecture, Design Rationale ("extract a shared
persistPackOrder-style private helper"). The delete-side change and the
label-side change do not depend on each other, but both are small,
self-contained, single-session changes to server-only code with no route
or MCP-layer changes required (`DELETE /packs/:id` and `delete_pack`
already call `services.packs.delete(...)` unchanged — see sprint.md's
"Why").

## Acceptance Criteria

- [ ] `PackService.delete()` wraps the pack delete, its `'deleted'` audit
      row, and a compaction pass over the kit's remaining packs in one
      `prisma.$transaction`. (Today the audit write happens after the
      delete, outside any transaction — this moves inside.)
- [ ] The two-phase negative-sentinel write (move changed packs to a
      unique negative value, then to final positive ranks) and the
      per-changed-pack audit-row logic are extracted from `renumber()`
      into one shared private helper that both `renumber()` and
      `delete()`'s compaction step call. No parallel/duplicated
      implementation of this logic exists anywhere in `PackService`.
- [ ] Deleting a middle pack (e.g., pack 3 of 5) results in the remaining
      packs numbered `1, 2, 3, 4` immediately after the delete — not
      after a subsequent edit.
- [ ] Deleting the last (highest-numbered) pack changes no other pack's
      `displayNumber` and writes no `displayNumber` audit rows for
      unaffected packs.
- [ ] Deleting the first pack shifts every remaining pack down by one.
- [ ] The delete and the compaction commit atomically — no intermediate
      state (pack row gone, but sibling numbering not yet compacted) is
      ever observable to a concurrent reader.
- [ ] `AuditLog` rows exist for the deleted pack (`field: 'deleted'`,
      unchanged from today) and for every remaining pack whose
      `displayNumber` changed (`field: 'displayNumber'`), with `source`
      matching how the delete was made (UI or MCP, per the calling
      `ServiceRegistry`'s configured source — same convention as
      `renumber()`).
- [ ] `renumber()`'s external behavior and return shape are unchanged by
      the internal refactor (existing `pack-renumber.service.test.ts`
      tests continue to pass without modification).
- [ ] `label.service.ts`'s private `getPackSequence()` method is deleted.
- [ ] `generatePackLabel` renders `${kit.number}/${pack.displayNumber}`
      instead of a sequence computed from `getPackSequence()`.
- [ ] `generateBatchLabels` renders each selected pack's
      `displayNumber`, not an index derived from `id ASC` order plus
      `findIndex`.
- [ ] `generateBatchHtml` renders each selected pack's `displayNumber`,
      not an index derived from `id ASC` order plus `findIndex`.
- [ ] After renumbering a kit's packs so `id` order and `displayNumber`
      order diverge, all three label-generation paths render numbers
      consistent with the kit's current `displayNumber` values, not the
      old `id`-order sequence.

## Implementation Plan

### Approach

**`PackService` (pack.service.ts):**

1. Extract a private helper, e.g. `persistPackOrder(tx, currentPacks,
   orderedIds, userId)`, from `renumber()`'s existing logic: given the
   kit's current packs (id + displayNumber) and a target order (pack ids
   in their final 1..N sequence), diff to find changed packs, apply the
   two-phase negative-sentinel update (`-id` sentinel, then final
   positive rank) via `tx.pack.update(...)`, and write audit entries
   (`field: 'displayNumber'`) for changed packs via `this.audit.write(...,
   tx)`. No-op (empty changes) short-circuits without touching the
   transaction.
2. Rewrite `renumber()` to compute its ranked/sorted target order (same
   sort-with-tie-break algorithm as today, unchanged), then call
   `persistPackOrder` inside its existing `$transaction`. External
   behavior, validation, and return value (`this.list(kitId)`) must not
   change.
3. Rewrite `delete()`:
   - Look up the existing pack (unchanged 404 check).
   - Open one `prisma.$transaction`.
   - `tx.pack.delete({ where: { id } })`.
   - Write the `'deleted'` audit entry via `this.audit.write(entry, tx)`
     (was previously `this.writeAudit(...)` outside any transaction —
     switch to passing `tx`).
   - Read remaining packs for the kit inside the same `tx`
     (`tx.pack.findMany({ where: { kitId: existing.kitId }, orderBy: {
     displayNumber: 'asc' } })`) — already-gap-closing order since it's
     just "current order minus the deleted row."
   - Call `persistPackOrder(tx, remainingPacks, remainingPacks.map(p =>
     p.id), userId)` — the target order is simply the remaining packs in
     their current relative order, re-ranked 1..N without the gap.

**`LabelService` (label.service.ts):**

4. Delete `getPackSequence()`.
5. `generatePackLabel`: replace `const seq = await
   this.getPackSequence(packId, pack.kit.id); const number =
   `${pack.kit.number}/${seq}`;` with `const number =
   `${pack.kit.number}/${pack.displayNumber}`;` — `pack.displayNumber` is
   already present on the existing `prisma.pack.findUnique(...)` result
   (Prisma returns all scalars by default; no `select`/`include` change
   needed here).
6. `generateBatchLabels` and `generateBatchHtml`: add `displayNumber:
   true` to the `kit.packs` query's `select`, drop the `orderBy: { id:
   'asc' }` in favor of `orderBy: { displayNumber: 'asc' }` (matches kit
   page print order — not behaviorally required but has no downside),
   and replace each `const allIdx = kit.packs.findIndex(p => p.id ===
   pack.id); const seq = allIdx + 1;` with `const seq =
   pack.displayNumber;` directly.

### Files to Modify

- `server/src/services/pack.service.ts` — extract shared helper; rewrite
  `renumber()` and `delete()` to use it.
- `server/src/services/label.service.ts` — delete `getPackSequence()`;
  update `generatePackLabel`, `generateBatchLabels`, `generateBatchHtml`.

### Testing Plan

- Extend `tests/server/services/pack-renumber.service.test.ts` with a
  new `describe('PackService.delete() compaction')` block, reusing its
  existing `createKitWithPacks`/`getDisplayNumbers`/`getDisplayNumberMap`
  helpers:
  - Delete a middle pack in a 5-pack kit → remaining packs numbered
    `1,2,3,4` with no gap.
  - Delete the last pack → other packs' numbers unchanged, no
    `displayNumber` audit rows written.
  - Delete the first pack → every remaining pack shifts down by one.
  - Audit rows: one `'deleted'` row for the deleted pack, one
    `'displayNumber'` row per pack whose number changed, none for
    unaffected packs.
  - Existing `renumber()` tests in this file must continue to pass
    unmodified after the internal refactor.
- Extend `tests/server/services/label.service.test.ts`: create a kit
  with several packs, use `getRegistry().packs.renumber(...)` to make
  `id` order and `displayNumber` order diverge, then:
  - For `generatePackLabel`/`generateBatchLabels` (PDF output): spy on
    `PDFDocument.prototype.text` (or equivalent capture point already
    reachable from this test file) to capture the rendered number string
    and assert it matches `${kit.number}/${pack.displayNumber}`, not the
    old id-order-derived value.
  - For `generateBatchHtml`: assert directly against the returned HTML
    string (plain inspectable text) that the correct `displayNumber`
    appears for each pack.
- Add route-level coverage in `tests/server/packs.test.ts` for `DELETE
  /packs/:id` (no delete tests exist there today): deleting a pack via
  the REST route compacts the remaining packs' numbers, verified via a
  follow-up `GET`/direct Prisma read.
- Run existing suites to confirm no regressions:
  `tests/server/services/pack-renumber.service.test.ts`,
  `tests/server/services/mcp-renumber-pack.test.ts`,
  `tests/server/packs.test.ts`,
  `tests/server/services/label.service.test.ts`, `tests/server/labels.test.ts`.
  Known baseline: 18 pre-existing failures across
  app/auth/github/pike13/integrations/issue.service are unrelated;
  `inventory-check.service` is a known latent flake (ObjectId
  collision). Use `--maxWorkers=2` for a full-suite run to converge.

### Documentation Updates

- None required outside code comments — no schema or public-contract
  change in this ticket. The extracted helper should carry a docstring
  explaining it is the single shared implementation `renumber()` and
  `delete()`'s compaction both call (mirrors the docstring convention
  already on `renumber()`).
