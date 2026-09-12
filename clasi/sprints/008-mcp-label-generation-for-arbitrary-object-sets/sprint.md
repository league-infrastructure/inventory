---
id: 008
title: MCP Label Generation for Arbitrary Object Sets
status: executing
branch: sprint/008-mcp-label-generation-for-arbitrary-object-sets
use-cases:
- SUC-001
- SUC-002
issues:
- mcp-label-generation-for-arbitrary-sets-of-computers-kits-and-packs.md
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Sprint 008: MCP Label Generation for Arbitrary Object Sets

## Goals

Let a Quartermaster generate printable label PDFs for kits, packs, and
computers directly through the Inventory MCP connector, without leaving the
conversation and without being limited to "one kit at a time" the way the
existing REST batch-PDF route is.

## Problem

Label printing today is reachable only through `server/src/routes/labels.ts`
and the web UI, both shaped around a single kit or a single computer batch.
The MCP tool registry (`server/src/mcp/tools.ts`, ~60 tools) has no label
tools at all, so an agent working conversationally cannot produce a label PDF
in any form. Even if a tool existed, two supporting gaps would still block
the three workflows the stakeholder wants (single object, whole-kit, and
arbitrary ad-hoc set):

1. `LabelService.generateBatchLabels(kitId, packIds)`
   (`label.service.ts:447`) resolves `packIds` by filtering one kit's
   `kit.packs`, so packs from different kits can never be requested
   together.
2. `list_computers` (`tools.ts:465`) takes an empty schema, even though
   `ComputerService.list()` already supports `siteId` / `kitId` /
   `disposition` / `unassigned` filters — so building an ad-hoc computer ID
   list means dumping the whole fleet into context.

## Solution

1. Add `LabelService.generateLabelSet(selection)` as a single entry point
   that accepts explicit `kitIds` / `packIds` / `computerIds` (plus an
   `includeKitPacks` flag), resolves packs individually (not through their
   kit) so cross-kit selection works, and returns one PDF bundle per label
   stock size (`102x59` for kits/packs, `89x28` for computers) — never a
   mixed-page PDF. The existing `generateBatchLabels` and
   `generateComputerBatchLabels` become thin wrappers over extracted private
   builders so the current REST routes and web UI are unaffected.
2. Register a `generate_labels` MCP tool that takes the same explicit ID
   lists, enforces a 60-label cap and a non-empty-selection check, and
   returns a text manifest plus one base64 `resource` block (PDF) per stock
   size. It uses `requireAuth` semantics only, matching every existing label
   route — no Quartermaster gate.
3. Add pass-through filters (`site_id`, `kit_id`, `disposition`,
   `unassigned`) to the existing `list_computers` MCP tool, exposing
   `ComputerService.list()` filtering that already exists at the service
   layer.

## Success Criteria

- A Quartermaster can, in one MCP call, print just a kit's label, a whole
  kit's labels (kit + all packs), or an arbitrary mix of computers and packs
  drawn from different kits.
- Cross-kit pack selection works: packs from two different kits requested
  together land in one correctly-captioned `102x59` bundle.
- No PDF ever mixes the two label stock sizes.
- The pre-existing REST batch-PDF routes produce byte-identical output
  before and after the refactor.
- `list_computers` supports the same filters `ComputerService.list()`
  already implements.

## Scope

### In Scope

- `LabelService.generateLabelSet()` and its two extracted private builders.
- `generate_labels` MCP tool registration, with cap/empty-selection guards.
- `list_computers` filter pass-through.
- Unit tests for `generateLabelSet` (cross-kit packs, mixed selections,
  `includeKitPacks` dedup, unknown-ID errors, over-cap error).
- A REST regression check (baseline PDF captured before the refactor,
  diffed after) to confirm the existing routes are unaffected.

### Out of Scope

- Search-filter-based label selection (the tool consumes explicit IDs only;
  finding IDs stays the job of `list_kits` / `list_packs` / `list_computers`).
- Signed-URL delivery as an alternative to embedded base64 PDFs — noted in
  the issue as a fallback if live-connector PDF-blob rendering proves
  unreliable, but not built speculatively in this sprint.
- Any change to label geometry, QR encoding, or the physical layout of
  existing labels.
- Schema/migration work — none is needed.

## Test Strategy

- Unit tests in `tests/server/services/` for `generateLabelSet`, covering
  the cases enumerated in the issue's Verification section 1 (cross-kit
  packs, mixed kit+computer selection, computer-only selection,
  `includeKitPacks` dedup, unknown ID, over-cap).
- Extend `tests/server/labels.test.ts` (currently 37 lines of auth-only
  smoke tests) to cover the new `generate_labels` tool's guard paths
  (empty selection, over-cap, non-QM auth).
- Regression check: capture a baseline PDF from
  `POST /api/labels/kit/:id/batch-pdf` before touching
  `generateBatchLabels`, then diff a post-refactor PDF for the same kit
  byte-for-byte (this is an acceptance criterion on the first ticket, not a
  separate ticket — it must happen at the moment of the refactor, not as an
  afterthought).
- `npm run test:server` (jest, `tests/server/jest.config.js`) must pass
  after each ticket.
- Live MCP verification against the Inventory connector (single kit,
  cross-kit packs, mixed kit+computer) is called out in the issue as a
  manual step; it is not part of the automated test suite for this sprint.

## Architecture

**Sizing: Compact.** This sprint adds one real behavioral change — a new
entry point on the existing `LabelService` (`generateLabelSet`, plus
extraction of two private builders and a switch from kit-scoped to
per-pack resolution) — and then exposes it through the MCP tool registry
using the exact same `registerTool` / `safeCall` / `getContext` pattern
already used by all ~60 existing tools. `list_computers`' filter change is
a direct pass-through to a service method (`ComputerService.list()`) that
already implements the filtering; no service-layer logic is added there.
No new module is introduced, no new cross-module dependency is created —
`LabelService` already exists in the Service Layer and MCP Tools already
depends on the Service Layer generically (architecture-005.md §3.5,
§5) — no dependency-direction change, and no data model change (no
migration). The two touched files (`label.service.ts`, `tools.ts`) are
changed in service of one coherent capability, not two independent
concerns, so this is treated as a single compact unit rather than
escalated to substantial by file count alone.

### Architecture Overview

**What changed:**

- `server/src/services/label.service.ts` — new public method
  `generateLabelSet(selection: LabelSelection): Promise<LabelBundle[]>`.
  Internally, the page-emit loops currently inline in
  `generateBatchLabels` (`:447`) and `generateComputerBatchLabels`
  (`:401`) are extracted into two private builders
  (`buildKitPackBundle`, `buildComputerBundle`, naming illustrative) that
  accept already-resolved Prisma records and return a `Buffer`. The
  existing per-label drawing helpers (`addLabelContent`,
  `addCompactLabelContent`, `buildInfoLine`, `generateQrBuffer`,
  `createDoc`, `createCompactDoc`) are untouched and reused as-is. Packs
  are now resolved individually via
  `prisma.pack.findUnique({ where: { id }, include: { kit: { select: { number: true } } } })`
  instead of being filtered against one kit's `packs` array — this is the
  one line of logic that unlocks cross-kit selection. The two existing
  public methods (`generateBatchLabels`, `generateComputerBatchLabels`)
  become thin wrappers calling the new private builders, so their
  observable behavior (and the REST routes / web UI that call them) is
  unchanged.
- `server/src/mcp/tools.ts` — one new tool, `generate_labels`, registered
  with `server.registerTool(...)` following the file's established
  pattern (same as `create_kit`, `update_pack`, etc.): resolves IDs via
  `getContext().services.label.generateLabelSet(...)`, wraps the call in
  `safeCall`, enforces the 60-label cap and non-empty-selection guard
  before calling the service, and returns `toolError` (not a thrown
  exception) for both guard failures. Auth is whatever `safeCall` /
  `getContext` already provide by default for a plain tool — `requireQM()`
  is deliberately *not* called, matching every route in
  `routes/labels.ts`. Separately, `list_computers`' schema gains four
  optional fields (`site_id`, `kit_id`, `disposition`, `unassigned`) that
  are passed straight through to the existing
  `ComputerService.list()` call; no new parameters reach the service that
  it doesn't already accept.

**Impact on existing components:** None outside the two files above. The
Service Layer's public contract grows (one new method on `LabelService`)
but nothing that currently depends on `LabelService` or on
`ComputerService.list()` changes behavior — `generateBatchLabels` and
`generateComputerBatchLabels` keep their existing signatures and outputs.

### Design Rationale

**Decision: resolve packs individually rather than widening the existing
kit-scoped query.**
*Context:* `generateBatchLabels` currently loads one kit and filters
`packIds` against `kit.packs`, which is why cross-kit selection is
impossible today.
*Alternatives considered:* (a) accept a list of `{kitId, packId}` pairs
from the caller, pushing kit disambiguation onto the MCP tool's schema;
(b) load all candidate kits up front and build a lookup map.
*Why this choice:* A direct `prisma.pack.findUnique` per pack ID keeps the
tool's input schema simple (bare `pack_ids: number[]`, matching the
stakeholder's explicit-ID-list decision) and keeps `NotFoundError`
reporting precise (names the specific missing pack ID, consistent with
existing behavior at `:418`/`:455`) without requiring the caller to already
know which kit a pack belongs to.
*Consequences:* One additional Prisma round-trip per pack instead of a
single batched query. At the sprint's declared 60-label cap this is
bounded and not a performance concern; a future ticket could batch this
with `findMany` + a lookup map if pack counts grow, without changing the
public `generateLabelSet` contract.

**Decision: split output into one PDF per stock size instead of one PDF
with mixed page sizes.**
*Context:* Kit/pack labels are 102×59mm; computer labels are 89×28mm; a
label printer feeds one roll at a time.
*Alternatives considered:* emit a single PDF with per-page size metadata
and let the client/printer handle mixed sizes.
*Why this choice:* Physical constraint, not a software one — a single
print job can't switch roll sizes mid-job. Splitting by stock is the only
option that produces a printable artifact.
*Consequences:* A mixed selection (e.g., some packs and some computers)
returns two `resource` blocks in one tool response instead of one; the
tool's manifest text lists both bundles so the caller knows to expect two
PDFs.

### Migration Concerns

None. No schema or data migration. The refactor of
`generateBatchLabels`/`generateComputerBatchLabels` into thin wrappers is
required to be behavior-preserving (see Test Strategy's regression check),
so existing REST callers and the web UI need no changes and no
coordinated deployment step.

## Use Cases

### SUC-001: Quartermaster Generates Labels for an Arbitrary Object Set via MCP
Parent: UC-018

- **Actor**: Quartermaster (working conversationally through the
  Inventory MCP connector)
- **Preconditions**: The Quartermaster already has the relevant kit,
  pack, and/or computer IDs (typically from a prior `list_kits` /
  `list_packs` / `list_computers` call in the same conversation).
- **Main Flow**:
  1. Quartermaster asks for labels for some combination of kits (optionally
     with `include_kit_packs`), packs (possibly from different kits), and/or
     computers.
  2. The agent calls `generate_labels` with the corresponding
     `kit_ids` / `pack_ids` / `computer_ids` / `include_kit_packs`.
  3. `LabelService.generateLabelSet` resolves and dedupes the selection,
     groups by label stock, and renders one PDF per stock size present in
     the selection.
  4. The tool returns a text manifest (bundle count, label count, and
     per-label captions) plus one base64 `resource` block per PDF.
- **Postconditions**: One PDF per distinct label stock size represented in
  the selection is available to the caller; no PDF mixes stock sizes.
- **Acceptance Criteria**:
  - [ ] Packs from two different kits requested together land in one
        `102x59` bundle with correct `kitNumber/displayNumber` captions.
  - [ ] A mixed kit+computer selection returns exactly two bundles
        (`102x59` and `89x28`).
  - [ ] `include_kit_packs=true` expands to every pack in the named kit(s)
        and dedupes against any explicitly-listed `pack_ids` for the same
        pack.
  - [ ] An unknown kit/pack/computer ID returns a `NotFoundError` naming
        that specific ID.
  - [ ] A selection totaling more than 60 labels returns a `toolError`
        stating the count, without truncating.
  - [ ] An empty selection (no IDs in any of the three lists) returns a
        `toolError` naming the three accepted parameters.
  - [ ] `generate_labels` does not require Quartermaster role — only
        `requireAuth`-equivalent access, matching `routes/labels.ts`.

### SUC-002: Quartermaster Narrows a Computer List via MCP Filters Before Requesting Labels
Parent: UC-018

- **Actor**: Quartermaster
- **Preconditions**: `ComputerService.list()` already supports `siteId`,
  `kitId`, `disposition`, and `unassigned` filters (unchanged by this
  sprint).
- **Main Flow**:
  1. Quartermaster asks for, e.g., "every active computer in kit 17."
  2. The agent calls `list_computers` with `kit_id` and `disposition` set,
     instead of listing the entire fleet and filtering in context.
  3. The returned, already-filtered computer list supplies the IDs passed
     to `generate_labels` (SUC-001).
- **Postconditions**: The Quartermaster obtains a filtered computer ID set
  in one call instead of a full-fleet dump.
- **Acceptance Criteria**:
  - [ ] `list_computers` accepts optional `site_id`, `kit_id`,
        `disposition`, and `unassigned` parameters.
  - [ ] Each filter, alone or combined, is passed through to
        `ComputerService.list()` unchanged — no new filtering logic is
        added at the tool layer.
  - [ ] Omitting all filters preserves today's behavior (full list).

## GitHub Issues

None — this sprint is tracked via the linked CLASI issue file only.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [x] Sprint planning document is complete (sprint.md, including its
      Architecture and Use Cases sections)
- [x] Architecture review passed (or skipped, for changes with no
      architectural impact)
- [ ] Stakeholder has approved the sprint plan

## Tickets

| # | Title | Depends On |
|---|-------|------------|
| 001 | LabelService.generateLabelSet — cross-kit resolution, stock splitting, unit tests | — |
| 002 | generate_labels MCP tool | 001 |
| 003 | list_computers filter pass-through | — |

Tickets execute serially in the order listed.
