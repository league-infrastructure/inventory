---
id: '001'
title: Shared kit/pack identifier resolver module
status: open
use-cases: [SUC-001, SUC-002]
depends-on: []
github-issue: ''
issue: mcp-tools-must-use-user-facing-identifiers-not-database-ids.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Shared kit/pack identifier resolver module

## Description

Foundational ticket for sprint 009. Adds a new module,
`server/src/mcp/identifiers.ts`, that resolves the identifiers users
actually speak — a kit number, and a kit-number+pack-number designator
— to internal primary keys, with explicit not-found errors. This is the
one place the "number → id" lookup lives, so tickets 002 and 003 (13 kit
tools + 8 pack tools) share a single implementation instead of
duplicating it 21 times.

Expose:

- A kit resolver taking a `kit_number` (`Kit.number`, `Int @unique`) and
  returning the matching kit's id (or the full record, if a call site
  needs it — the exact return shape is an implementation choice). Throws
  an explicit error — e.g. `Kit number 26 not found` — when no kit has
  that number. Never falls back to treating the input as `Kit.id`.
- A pack resolver taking either a structured `{kit_number, pack_number}`
  pair or the combined `"kit_number/pack_number"` string (e.g. `"26/1"`,
  matching the label as printed and as users say it). It resolves the
  kit by number first (reusing the kit resolver's not-found semantics),
  then looks up the `Pack` via the existing `@@unique([kitId,
  displayNumber])` constraint. Throws a distinct, explicit error for "kit
  not found" vs. "pack not found within that kit" — e.g. `Kit number 26
  not found` vs. `Pack 26/9 not found`.

Both are pure lookups: no side effects, no dependency on any one tool's
argument shape. This ticket does not touch tool registration in
`server/src/mcp/tools.ts` — that begins in ticket 002. It should be
buildable and testable standalone.

## Acceptance Criteria

- [ ] `server/src/mcp/identifiers.ts` exports a kit-number resolver and a
      pack-designator resolver (naming/signatures at implementer's
      discretion, consistent with the existing style of
      `server/src/mcp/context.ts` / `tools.ts`).
- [ ] A valid `kit_number` resolves to the correct `Kit`; an unknown
      number throws an explicit, tool-facing error and never falls back
      to interpreting the number as a database id.
- [ ] A valid `(kit_number, pack_number)` pair, and the equivalent
      combined `"kit_number/pack_number"` string, both resolve to the
      correct `Pack`; an unknown kit or an unknown pack-within-kit
      throws an explicit, distinguishable error.
- [ ] Collision test passes: kit number 26 (database id 17) and kit
      number 17 resolve to their own distinct kits; packs 503 (`"26/1"`),
      413 (`"16/1"`), and 535 (`"7/1"`) each resolve to their own
      distinct pack.
- [ ] No existing tool in `tools.ts` is modified by this ticket.

## Implementation Plan

**Approach**: Add one new file exporting the two resolver functions,
built on the existing `PrismaClient` (or `ServiceRegistry`) plumbing
already used throughout `server/src/mcp/`. Reuse the existing
`NotFoundError` type from `server/src/services/errors.ts` (or an
equivalent), so the resolvers integrate with the same error-to-tool-error
handling `safeCall()` already performs in `tools.ts` — no new
error-surfacing mechanism is needed.

**Files to create**:
- `server/src/mcp/identifiers.ts` — the two resolver functions.

**Files to modify**: none (tool registrations are out of this ticket's
scope).

**Testing plan**:
- New file `tests/server/services/mcp-identifiers.test.ts` (or similar),
  covering: valid kit number → correct id; unknown kit number → explicit
  error, no id fallback; valid pack (structured pair and `"26/1"`
  string) → correct id; unknown kit / unknown pack-within-kit → explicit,
  distinguishable errors; the exact collision fixtures (kit 26/id 17 vs.
  kit 17; packs 503/413/535).
- Run full `npm run test:server` to confirm the new module introduces no
  regressions against the tracked baseline.

**Documentation updates**: none required beyond code comments explaining
the resolver's contract (mirroring the doc-comment density already
present in `pack.service.ts`/`kit.service.ts`).

## Testing

- **Existing tests to run**: `npm run test:server` (confirm the tracked
  baseline — 309 passed / 41 failed / 350 total — is unaffected).
- **New tests to write**: `tests/server/services/mcp-identifiers.test.ts`
  as described above, including the kit 26/17 and pack 503/413/535
  collision fixtures.
- **Verification command**: `npm run test:server`.
