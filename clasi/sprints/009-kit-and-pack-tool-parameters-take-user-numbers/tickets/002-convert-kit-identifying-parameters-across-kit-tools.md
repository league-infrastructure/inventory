---
id: '002'
title: Convert kit-identifying parameters across kit tools
status: open
use-cases: [SUC-001, SUC-003]
depends-on: ['001']
github-issue: ''
issue: mcp-tools-must-use-user-facing-identifiers-not-database-ids.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Convert kit-identifying parameters across kit tools

## Description

Using the resolver module from ticket 001, convert the kit-identifying
parameter on each of the following `server/src/mcp/tools.ts`
registrations from a database id (`id`/`kitId`/`kit_id`) to `kit_number`
(or `kit_numbers` for the array case), resolving to the internal id via
the ticket-001 resolver before delegating to the existing service call
exactly as today:

- `get_kit` (`id` → `kit_number`)
- `update_kit` (`id` → `kit_number`)
- `delete_kit` (`id` → `kit_number`)
- `set_kit_last_inventoried` (`kitId` → `kit_number`)
- `list_packs` (`kitId` → `kit_number`, optional filter)
- `create_pack` (`kitId` → `kit_number`)
- `transfer_kit` (`kitId` → `kit_number`)
- `list_computers` (`kit_id` → `kit_number`, optional filter — added in
  sprint 008, one of the two known-newest instances of the defect)
- `create_computer` (`kitId` → `kit_number`, optional)
- `update_computer` (`kitId` → `kit_number`, optional/nullable — preserve
  the existing "pass null/`\"null\"` to clear" semantics for a *number*
  field, not an id field)
- `list_issues` (`kitId` → `kit_number`, optional filter only — this
  ticket does not touch this tool's `packId` param, which is ticket
  003's responsibility, nor `computerId`, which is out of scope)
- `create_issue` (`kitId` → `kit_number`, optional — same note: leave
  `packId`/`computerId` alone)
- `generate_labels` (`kit_ids` array → `kit_numbers` array — added in
  sprint 008, the other known-newest instance of the defect; this
  ticket does not touch `pack_ids` or `computer_ids` on this tool)

For every converted parameter:
- Rename the zod schema field, preserving its existing type/optionality/
  nullability.
- Update the tool's description string to reference the new parameter
  name and stop telling the model to "look up the database id first" —
  that guidance becomes wrong once the parameter takes the number
  directly. (The broader `MCP_INSTRUCTIONS` rewrite is ticket 004 — this
  ticket only touches the individual tool description strings for the
  tools it converts.)
- Resolve `kit_number` via the ticket-001 resolver in the handler body,
  then call into the existing service exactly as before using the
  resolved id.
- Preserve QM-gating (`_meta.requiresQM` / `requireQM()`) exactly as it
  is today — this ticket changes parameter identity only, not
  authorization.

Do not modify pack-identifying (`packId`) or computer-identifying
parameters on any of these tools — pack conversion is ticket 003;
computer identification is out of scope for this sprint.

## Acceptance Criteria

- [ ] Every tool listed above takes `kit_number` (or `kit_numbers` for
      `generate_labels`) instead of a kit database-id parameter, and no
      longer accepts `id`/`kitId`/`kit_id` for kit identification.
- [ ] Each converted tool: a valid `kit_number` resolves to and operates
      on the correct kit; an unknown `kit_number` returns an explicit
      "Kit number N not found" tool error, not a crash and not silent
      misresolution.
- [ ] Collision case verified on at least `get_kit` and `generate_labels`:
      `kit_number: 26` (database id 17) and `kit_number: 17` each
      resolve to and operate on their own correct, distinct kit.
- [ ] `generate_labels(kit_numbers=[17])` produces labels captioned for
      Kit 17 — the exact regression named in the sprint issue — not Kit
      26.
- [ ] `list_computers`'s `kit_id` filter and `generate_labels`'s
      `kit_ids` (both added in sprint 008) are converted.
- [ ] Existing null-clearing behavior for nullable kit-reference fields
      (e.g. `update_computer`) still works after the rename.
- [ ] QM-gating on every converted tool is unchanged — the existing
      `_meta.requiresQM` assertions in
      `tests/server/services/mcp-tool-metadata.test.ts` still pass.
- [ ] `pack_ids`/`packId`/computer-identifying parameters on shared
      tools (`generate_labels`, `list_issues`, `create_issue`,
      `list_computers`) are untouched by this ticket.

## Implementation Plan

**Approach**: Mechanical, tool-by-tool conversion using the ticket-001
resolver. Each handler's first step becomes "resolve `kit_number` to
`kitId`," after which the rest of the handler body calls the existing
service exactly as it does today — service signatures do not change.

**Files to modify**:
- `server/src/mcp/tools.ts` — the 13 tool registrations listed above
  (schema, description, handler).

**Testing plan**:
- Per-tool unit tests: valid `kit_number` → correct record; unknown
  `kit_number` → explicit error.
- Collision regression test on `get_kit` and `generate_labels`: kit
  number 26 / database id 17 vs. kit number 17.
- Full `npm run test:server`, with particular attention to
  `tests/server/labels.test.ts` and
  `tests/server/services/label.service.test.ts` (both exercise
  `generate_labels`, which this ticket partially converts).

**Documentation updates**: none beyond the in-file tool description
strings called out above.

## Testing

- **Existing tests to run**: `npm run test:server` in full — confirm no
  new failures beyond the tracked 8 pre-existing suites (baseline: 309
  passed / 41 failed / 350 total).
- **New tests to write**: per converted tool, a valid-number and an
  unknown-number case; the kit 26/17 collision case on `get_kit` and
  `generate_labels` specifically (the regression test named in the
  issue).
- **Verification command**: `npm run test:server`.
