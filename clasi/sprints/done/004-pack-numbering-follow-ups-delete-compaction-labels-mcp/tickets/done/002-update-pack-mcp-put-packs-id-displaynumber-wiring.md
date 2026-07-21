---
id: '002'
title: update_pack MCP + PUT /packs/:id displayNumber wiring
status: done
use-cases:
- SUC-003
depends-on:
- '001'
github-issue: ''
issue: pack-numbering-followups-delete-compaction-labels-mcp.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# update_pack MCP + PUT /packs/:id displayNumber wiring

## Description

Neither the `update_pack` MCP tool nor `PUT /packs/:id` currently know
about `displayNumber` — only `name`/`description` are editable through
either. A stakeholder-run agent trying to fix a pack's number through
`update_pack` found the field missing and nearly resorted to
delete-and-recreate, a data-loss risk. Add `displayNumber` to both,
always delegating to `PackService.renumber()` (never a raw column
write), and cross-reference `renumber_pack` in both tools' descriptions
so agents discover the dedicated tool.

Depends on ticket 001 only in the sense that it lands after 001's
`PackService` refactor is in place (both touch `pack.service.ts`
indirectly, 001 first); this ticket calls the existing public
`renumber()` method and does not depend on 001's internal helper
extraction to function correctly — it depends on 001 for sequencing,
not for a required interface change.

Per sprint.md's Architecture / Design Rationale:
- `update_pack`, when `displayNumber` is supplied, returns the **full
  renumbered kit pack list** (identical shape to `renumber_pack`'s
  response) rather than a single pack record — because the caller needs
  to see every pack whose number shifted, not just the one it named.
- `PUT /packs/:id`, when `displayNumber` is supplied, delegates to
  `renumber()` internally but **keeps its existing single-record
  response shape** (`PackDetailRecord` for the edited pack only) — this
  preserves sprint 003's established `PUT` contract rather than
  overriding it. A caller needing the full shifted set still uses
  `PATCH /packs/:id/renumber`.

## Acceptance Criteria

- [x] `update_pack`'s MCP tool schema accepts an optional
      `displayNumber: z.number()`.
- [x] When `update_pack` is called with `name`/`description` only (no
      `displayNumber`), its behavior and single-`PackDetailRecord`
      response are unchanged from today.
- [x] When `update_pack` is called with `displayNumber` (alone or
      alongside `name`/`description`): any `name`/`description` change is
      applied via the existing `services.packs.update(...)` call, then
      `services.packs.renumber(pack.kitId, id, displayNumber, user.id)`
      is called and its full-list result is returned as the tool
      response.
- [x] Given the same starting pack numbers and the same requested
      number, `update_pack` (with `displayNumber` set) and `renumber_pack`
      produce the identical final `1..N` assignment (same underlying
      `renumber()` call).
- [x] `update_pack` never writes `displayNumber` via a raw
      `prisma.pack.update({ data: { displayNumber } })` — the only path
      to persisting it is through `PackService.renumber()`.
- [x] `update_pack`'s tool description states its `displayNumber`
      behavior (including the conditional response shape) and points to
      `renumber_pack` for a dedicated renumber call.
- [x] `renumber_pack`'s tool description gains one added line noting that
      `update_pack` also accepts `displayNumber` for combined
      name/description + number edits.
- [x] `PUT /packs/:id` accepts an optional `displayNumber` in its request
      body.
- [x] When `PUT /packs/:id` is called with `displayNumber`: the route
      resolves the pack's `kitId`, calls
      `services.packs.renumber(kitId, id, displayNumber, user.id)`, then
      re-fetches and returns `services.packs.get(id)` — a single
      `PackDetailRecord` for the edited pack reflecting its new number.
      Other packs in the kit may also have shifted as a side effect but
      are not included in this response (documented behavior, not a
      bug — see Description).
- [x] `PUT /packs/:id`'s response remains a single `PackDetailRecord` in
      every case (with or without `displayNumber` in the request) — no
      change to its existing response shape/contract.
- [x] `PUT /packs/:id` never writes `displayNumber` via a raw column
      update — only through `renumber()`.
- [x] `contracts/pack.ts`'s `UpdatePackInput` gains an optional
      `displayNumber?: number` field.
- [x] An out-of-range `displayNumber` (per `renumber()`'s existing
      `1..N` validation) passed to either `update_pack` or
      `PUT /packs/:id` is rejected with the same validation error
      `renumber_pack`/`PATCH .../renumber` already produce, with no
      packs changed.

## Implementation Plan

### Approach

**Contract (`contracts/pack.ts`):**

1. Add `displayNumber?: number;` to `UpdatePackInput`.

**MCP (`server/src/mcp/tools.ts`):**

2. `update_pack`'s zod schema gains `displayNumber: z.number().optional()`.
3. Handler logic: destructure `displayNumber` out of the input separately
   from `name`/`description`. If `name` or `description` is present, call
   `services.packs.update(id, { name, description }, user.id)` as today.
   If `displayNumber` is present, look up the pack's `kitId` (via
   `services.packs.get(id)`, same pattern `renumber_pack` already uses)
   and call `services.packs.renumber(pack.kitId, id, displayNumber,
   user.id)`, returning `ok(...)` of that result instead of the
   `update()` result. If only `name`/`description` were present, return
   the `update()` result as today.
4. Update `update_pack`'s description string to state the `displayNumber`
   behavior and reference `renumber_pack`. Add one line to
   `renumber_pack`'s existing description noting `update_pack` also
   accepts `displayNumber`.

**REST (`server/src/routes/packs.ts`):**

5. In the `PUT /packs/:id` handler: if `req.body.displayNumber` is
   present, look up the pack (`services.packs.get(id)`) to get `kitId`,
   call `services.packs.renumber(kitId, id, req.body.displayNumber,
   user.id)`, then respond with `services.packs.get(id)` (single record,
   refreshed). If `name`/`description` are also present in the body,
   apply them via the existing `services.packs.update(...)` call before
   the renumber call (same ordering as the MCP tool, for consistency).
   If `displayNumber` is absent, behavior is unchanged (existing
   `update()`-only path).

### Files to Modify

- `server/src/contracts/pack.ts` — `UpdatePackInput.displayNumber?`.
- `server/src/mcp/tools.ts` — `update_pack` schema/handler;
  `update_pack` and `renumber_pack` description strings.
- `server/src/routes/packs.ts` — `PUT /packs/:id` handler.

### Testing Plan

- Extend `tests/server/services/mcp-renumber-pack.test.ts` (or add a
  sibling file following its fake-server-collector pattern for
  `update_pack`'s handler): 
  - `update_pack` with `displayNumber` produces the same final
    assignment as `renumber_pack` for an equivalent input (structural
    comparison, following the existing `uiByPosition`/`mcpByPosition`
    pattern already in that file).
  - `update_pack` with `name`/`description` only is unaffected (still
    returns a single record, no `renumber()` call).
  - `update_pack` with an out-of-range `displayNumber` is rejected with
    no packs changed.
- Extend `tests/server/packs.test.ts`: add a `describe('PUT
  /api/packs/:id displayNumber')` block (alongside the existing `PATCH
  /api/packs/:id/renumber` describe block, reusing its
  `createKitWithPacks` helper):
  - `PUT /packs/:id` with `displayNumber` produces the same renumbered
    outcome (verified via a follow-up read of all packs in the kit) as
    an equivalent `PATCH /packs/:id/renumber` call.
  - The `PUT` response is a single object (`PackDetailRecord`), not an
    array — asserted explicitly to guard the shape-preservation
    decision.
  - Out-of-range `displayNumber` via `PUT` returns 400 with no packs
    changed.
  - Non-quartermaster / unauthenticated requests are rejected the same
    as the existing `PUT /packs/:id` tests already verify for
    name/description edits.
- Run existing suites to confirm no regressions:
  `tests/server/services/mcp-renumber-pack.test.ts`,
  `tests/server/services/pack-renumber.service.test.ts`,
  `tests/server/packs.test.ts`. Known baseline: 18 pre-existing failures
  across app/auth/github/pike13/integrations/issue.service are
  unrelated; use `--maxWorkers=2` for a full-suite run to converge.

### Documentation Updates

- Tool description strings for `update_pack` and `renumber_pack` in
  `server/src/mcp/tools.ts` are themselves the primary documentation
  surface for this ticket (agents read these directly) — updating them
  per the Acceptance Criteria above is the documentation update. No
  separate docs files require changes.
