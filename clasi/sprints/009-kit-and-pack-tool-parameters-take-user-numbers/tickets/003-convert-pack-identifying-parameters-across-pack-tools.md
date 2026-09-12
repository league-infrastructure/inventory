---
id: '003'
title: Convert pack-identifying parameters across pack tools
status: open
use-cases: [SUC-002, SUC-003]
depends-on: ['001', '002']
github-issue: ''
issue: mcp-tools-must-use-user-facing-identifiers-not-database-ids.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Convert pack-identifying parameters across pack tools

## Description

Using the resolver module from ticket 001, convert the pack-identifying
parameter on each of the following `server/src/mcp/tools.ts`
registrations from a database id (`id`/`packId`) to the `kit_number` +
`pack_number` designator (also accepting the combined
`"kit_number/pack_number"` string form, per ticket 001's resolver):

- `update_pack` (`id` → designator)
- `delete_pack` (`id` → designator)
- `renumber_pack` (`id` → designator identifying *which* pack to move;
  its existing `displayNumber` parameter — the *target* number the pack
  is being renumbered to — is untouched, since that is already a
  user-facing number, not an id)
- `list_items` (`packId` → designator, optional filter)
- `create_item` (`packId` → designator)
- `list_issues` (`packId` → designator, optional filter only — this
  ticket only touches `packId`; `kitId`/`kit_number` was already
  converted in ticket 002, `computerId` is out of scope)
- `create_issue` (`packId` → designator, optional — same note)
- `generate_labels` (`pack_ids` array → array of designators —
  `kit_ids`/`kit_numbers` already converted in ticket 002;
  `computer_ids` is out of scope)

For every converted parameter:
- Update the zod schema to accept the structured pair and/or combined
  string, matching the input shape ticket 001's resolver accepts.
- Update the tool's description string to reference the new
  parameter(s) and drop any remaining "look up the database id first"
  guidance for packs.
- Resolve the designator via the ticket-001 resolver in the handler
  body, then call into the existing service exactly as before using the
  resolved id.
- Preserve QM-gating exactly as it is today.
- `update_pack`'s existing `displayNumber` renumbering behavior
  (delegating to the shared `PackService.renumber()` algorithm) is
  unchanged — only the parameter identifying *which* pack is being
  updated changes.

Do not modify kit-identifying or computer-identifying parameters on any
of these tools in this ticket — those are ticket 002 (already done, by
dependency) and out of scope, respectively.

## Acceptance Criteria

- [ ] Every tool listed above takes a `kit_number` + `pack_number`
      designator (structured pair or combined `"26/1"` string) instead
      of a pack database-id parameter, and no longer accepts
      `id`/`packId` for pack identification.
- [ ] Each converted tool: a valid designator resolves to and operates
      on the correct pack; an unknown kit number, or an unknown
      pack-within-kit, returns an explicit tool error, not silent
      misresolution.
- [ ] Collision case verified on at least `update_pack` or `list_items`:
      packs 503 (`"26/1"`), 413 (`"16/1"`), and 535 (`"7/1"`) each
      resolve to and operate on their own distinct pack.
- [ ] `generate_labels`'s `pack_ids` (added in sprint 008) is converted
      — the pack-side counterpart of ticket 002's `kit_ids`/`kit_id`
      conversions.
- [ ] `renumber_pack`'s target `displayNumber` parameter is unchanged;
      only the parameter identifying which pack changes.
- [ ] QM-gating on every converted tool is unchanged — existing
      `_meta.requiresQM` assertions in
      `tests/server/services/mcp-tool-metadata.test.ts` still pass.
- [ ] Kit-identifying and computer-identifying parameters on shared
      tools (`generate_labels`, `list_issues`, `create_issue`) are
      untouched by this ticket (verify ticket 002's kit conversions on
      these same tools still work correctly after this ticket's edits).

## Implementation Plan

**Approach**: Mechanical, tool-by-tool conversion using the ticket-001
pack-designator resolver. Each handler's first step becomes "resolve the
designator to `packId`," after which the rest of the handler body calls
the existing service exactly as it does today — service signatures do
not change.

**Files to modify**:
- `server/src/mcp/tools.ts` — the 8 tool registrations listed above
  (schema, description, handler). Several of these (`generate_labels`,
  `list_issues`, `create_issue`) were already touched by ticket 002 for
  their kit-side parameter; this ticket edits the same registrations
  again for their pack-side parameter.

**Testing plan**:
- Per-tool unit tests: valid designator → correct record; unknown kit
  or unknown pack-within-kit → explicit error.
- Collision regression test on `update_pack` or `list_items`: packs
  503/413/535.
- Full `npm run test:server`, with particular attention to
  `tests/server/services/mcp-renumber-pack.test.ts`,
  `tests/server/labels.test.ts`, and
  `tests/server/services/label.service.test.ts`.

**Documentation updates**: none beyond the in-file tool description
strings called out above.

## Testing

- **Existing tests to run**: `npm run test:server` in full — confirm no
  new failures beyond the tracked 8 pre-existing suites.
- **New tests to write**: per converted tool, a valid-designator and an
  unknown-designator case; the pack 503/413/535 collision case on at
  least one tool.
- **Verification command**: `npm run test:server`.
