---
id: '002'
title: "generate_labels MCP tool"
status: open
use-cases: [SUC-001]
depends-on: ['001']
github-issue: ''
issue: mcp-label-generation-for-arbitrary-sets-of-computers-kits-and-packs.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# generate_labels MCP tool

## Description

Register a `generate_labels` tool in `server/src/mcp/tools.ts` that
exposes `LabelService.generateLabelSet` (ticket 001) to MCP clients. The
tool accepts explicit `kit_ids` / `pack_ids` / `computer_ids` /
`include_kit_packs`, enforces a 60-label cap and a non-empty-selection
check before calling the service, and returns a text manifest plus one
base64 `resource` block (PDF) per label-stock bundle. This is the only
ticket that touches tool registration, request validation, or response
shaping — all label resolution and rendering logic lives in ticket 001's
`LabelService.generateLabelSet`.

## Acceptance Criteria

- [ ] `generate_labels` is registered via `server.registerTool(...)`,
      following the same pattern as existing tools (e.g. `create_kit`,
      `update_pack`) — using `getContext()`, `safeCall`, and `toolError`
      as established at the top of `tools.ts`.
- [ ] Input schema: `kit_ids?: number[]`, `pack_ids?: number[]`,
      `computer_ids?: number[]`, `include_kit_packs?: boolean`, matching
      the issue's sketch.
- [ ] Tool description text explains: PDF-per-stock-size behavior, that
      packs may come from different kits, and that IDs should be found
      first via `list_kits` / `list_packs` / `list_computers`.
- [ ] **Empty selection guard**: if all three ID lists are empty/omitted,
      return `toolError` naming the three accepted parameters
      (`kit_ids`, `pack_ids`, `computer_ids`) — do not call the service.
- [ ] **60-label cap guard**: compute the total label count the selection
      would produce (including `include_kit_packs` expansion) before
      calling `generateLabelSet`; if it exceeds 60, return `toolError`
      stating the actual count and asking the caller to split the
      request. Never silently truncate.
- [ ] On success, the tool result's `content` array contains one `text`
      block (JSON: `{ bundles: [{ stock, labelCount, contents }] }`,
      omitting the raw PDF bytes) followed by one `resource` block per
      bundle: `{ type: 'resource', resource: { uri:
      'inventory://labels/${stock}.pdf', mimeType: 'application/pdf',
      blob: <base64> } }`.
- [ ] **Auth**: the tool does *not* call `requireQM()` — it uses whatever
      baseline auth `safeCall`/`getContext` apply to a plain tool by
      default, matching every route in `routes/labels.ts` (all
      `requireAuth`, none Quartermaster-gated). Confirm this by checking
      how a comparable non-QM-gated existing tool is registered (e.g.
      `list_kits`) and mirroring that, not the QM-gated pattern used by
      `create_kit`/`update_kit`/etc.
- [ ] Unknown IDs surfaced by `generateLabelSet` (`NotFoundError`)
      propagate as tool errors via the existing `safeCall`/error-handling
      pattern — no separate error handling is added in this tool beyond
      what `safeCall` already provides.
- [ ] `npm run test:server` passes.

## Implementation Plan

**Approach**: This ticket is a thin registration layer over ticket 001's
service method. Read the existing registration of a representative
non-QM tool (`list_kits` or similar) and a representative
`registerTool`-based tool (e.g. `create_pack`) to match both the
`server.tool` vs. `server.registerTool` calling convention and the
auth pattern exactly — do not introduce a new auth path. Implement the
cap check by summing expected label counts from the selection (kit count
+ resolved pack count, accounting for `include_kit_packs` expansion +
computer count) — this may require a lightweight resolution step before
calling `generateLabelSet`, or `generateLabelSet` itself may need to
expose enough information to check the cap before rendering; use
judgment on whether the cap check needs its own resolution pass or can
reuse `generateLabelSet`'s internal resolution (discuss/resolve during
implementation if `generateLabelSet`'s signature needs a small
non-breaking addition to support a pre-render count, e.g. accepting a
`dryRun` style flag — but prefer keeping ticket 001's method unchanged
if a simple upper-bound count from the raw ID lists plus
`include_kit_packs` pack lookups suffices).

**Files to modify**:
- `server/src/mcp/tools.ts` — register `generate_labels`.

**Files to create/extend**:
- `tests/server/labels.test.ts` — extend with `generate_labels` tool
  tests (currently only 37 lines of auth-only smoke tests).

**Testing plan**:
- **Existing tests to run**: `npm run test:server`.
- **New tests to write**:
  - Empty selection returns `toolError` naming the three parameters.
  - A selection over the 60-label cap returns `toolError` stating the
    count, without truncating or calling `generateLabelSet`.
  - A valid single-kit selection (with `include_kit_packs: true`) returns
    a text manifest and one `resource` block.
  - A mixed kit+computer selection returns two `resource` blocks.
  - Confirm the tool does not require Quartermaster role (a non-QM
    authenticated caller succeeds), matching `routes/labels.ts` auth.
- **Verification command**: `npm run test:server`

**Documentation updates**: None beyond the tool's own `description` field
(read by MCP clients as the tool's user-facing documentation) — there is
no separate MCP tool reference doc in this repo to update.
