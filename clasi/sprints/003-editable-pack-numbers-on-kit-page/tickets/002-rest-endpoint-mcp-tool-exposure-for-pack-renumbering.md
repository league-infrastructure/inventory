---
id: '002'
title: REST endpoint + MCP tool exposure for pack renumbering
status: open
use-cases: [SUC-002, SUC-003]
depends-on: ['001']
github-issue: ''
issue: editable-pack-numbers-on-kit-page.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# REST endpoint + MCP tool exposure for pack renumbering

## Description

Expose ticket 001's `PackService.renumber()` through both the web UI's
REST route and the MCP server, with each surface calling the exact same
service method — no route- or tool-side reimplementation of the
algorithm, so the two paths cannot diverge (issue requirement 4).

## Acceptance Criteria

- [ ] `PATCH /packs/:id/renumber` added to `server/src/routes/packs.ts`:
  - [ ] Gated by `requireQuartermaster` (matching the existing
        `PUT /packs/:id` convention for pack mutations).
  - [ ] Request body: `{ displayNumber: number }`.
  - [ ] Looks up the pack's `kitId` internally (caller supplies only the
        pack id + requested number, not the kit id) and calls
        `services.packs.renumber(kitId, id, displayNumber, user.id)`.
  - [ ] Response: the full renumbered `PackRecord[]` for the kit (not a
        single pack), matching `renumber()`'s return shape.
  - [ ] Out-of-range/invalid input surfaces `PackService`'s
        `ValidationError` as a 4xx with the existing error-handling
        middleware pattern used by other routes in this file.
- [ ] `renumber_pack` MCP tool added to `server/src/mcp/tools.ts`,
      grouped under the existing `─── Packs ───` section:
  - [ ] Args: `{ id: z.number(), displayNumber: z.number() }`.
  - [ ] Calls `requireQM()` (matching `create_pack`/`update_pack`/
        `delete_pack`'s existing access-control pattern in this file).
  - [ ] Looks up the pack's `kitId` and calls
        `services.packs.renumber(...)` — same call as the REST route,
        no separate logic.
  - [ ] Tool description follows the file's existing convention of
        warning against surfacing database ids to end users where
        relevant (see `get_kit`'s description for the pattern).
- [ ] Both surfaces produce identical final `displayNumber` assignments
      for the same starting state and input (verified by a shared test
      fixture/scenario run through both paths — see Testing).
- [ ] `AuditLog` rows from the REST path have `source: UI`; rows from
      the MCP path have `source: MCP` (this falls out automatically
      from `ServiceRegistry.create(prisma, 'UI' | 'MCP')`'s existing
      source-threading — verify it, don't reimplement it).

## Testing

- **Existing tests to run**: whichever existing route-level tests cover
  `server/src/routes/packs.ts` today (check `tests/server/` for an
  app-level route test covering packs; if none exists, note that this
  ticket introduces the first one for this router alongside the new
  test below).
- **New tests to write**:
  - Route test: `PATCH /packs/:id/renumber` happy path (returns the
    renumbered list, matches ticket 001's stakeholder examples end to
    end through the HTTP layer), non-QM user rejected, out-of-range
    number rejected with no packs changed.
  - MCP tool test: `renumber_pack` happy path returns the same
    assignment as the equivalent REST call for the same starting state;
    QM-access enforcement; confirm `AuditLog.source` is `MCP` for a
    tool-driven call versus `UI` for a route-driven call in the same
    test file (reuse `tests/server/services/audit-source.test.ts`'s
    pattern for asserting `source` if applicable).
- **Verification command**: `cd tests/server && npx jest` scoped to the
  new/changed route and MCP test files (see `tests/server/jest.config.js`).

## Documentation Updates

- None required beyond the MCP tool's in-line description string (MCP
  tool descriptions double as the only "docs" for MCP consumers in this
  codebase, per the existing pattern in `tools.ts`).
