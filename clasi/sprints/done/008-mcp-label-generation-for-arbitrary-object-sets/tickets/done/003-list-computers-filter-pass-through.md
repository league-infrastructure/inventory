---
id: '003'
title: list_computers filter pass-through
status: done
use-cases:
- SUC-002
depends-on: []
github-issue: ''
issue: mcp-label-generation-for-arbitrary-sets-of-computers-kits-and-packs.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# list_computers filter pass-through

## Description

`list_computers` (`server/src/mcp/tools.ts:465`) currently takes an empty
`{}` input schema, even though `ComputerService.list()`
(`server/src/services/computer.service.ts:44`) already implements
`siteId` / `kitId` / `disposition` / `unassigned` filtering. Add those
same filters to the tool's input schema and pass them straight through to
the existing service call — no new filtering logic. This lets a caller
narrow a computer search (e.g. "every active computer in kit 17") in one
call instead of listing the whole fleet and filtering by hand, which
matters for building ID lists to feed into `generate_labels` (ticket 002)
without dumping the entire fleet into context. This ticket has no
dependency on tickets 001 or 002 and can be done independently, in
parallel or last.

## Acceptance Criteria

- [x] `list_computers`'s input schema gains four optional fields:
      `site_id?: number`, `kit_id?: number`, `disposition?: <matching
      ComputerService's existing disposition type>`, `unassigned?:
      boolean`.
- [x] Each provided filter is passed straight through to
      `getContext().services.computer.list(...)` (or equivalent existing
      call site) unchanged — no new validation or filtering logic is
      added at the tool layer beyond what `ComputerService.list()` already
      enforces.
- [x] Filters compose: providing more than one (e.g. `kit_id` +
      `disposition`) narrows on both, matching `ComputerService.list()`'s
      existing behavior when called with multiple filters.
- [x] Omitting all filters preserves today's behavior — the full computer
      list, unchanged in shape and ordering.
- [x] Tool description text is updated to mention the new filters.
- [x] `npm run test:server` passes.

## Implementation Plan

**Approach**: Read `ComputerService.list()` (`computer.service.ts:44`) to
confirm exact parameter names/types for `siteId`, `kitId`, `disposition`,
`unassigned`, then mirror those as the tool's snake_case schema fields
(consistent with this codebase's other tools, e.g. `include_kit_packs`
in ticket 002), converting to the service's camelCase call signature at
the call site. This is a pass-through only — resist adding any filtering
behavior beyond what the service already does.

**Files to modify**:
- `server/src/mcp/tools.ts` — update `list_computers`'s schema and its
  call to `ComputerService.list()`.

**Testing plan**:
- **Existing tests to run**: `npm run test:server`.
- **New tests to write**:
  - `list_computers` with `kit_id` set returns only that kit's computers.
  - `list_computers` with `disposition` set returns only computers with
    that disposition.
  - `list_computers` with `site_id` and `unassigned` combined narrows on
    both.
  - `list_computers` with no filters returns the same result shape as
    today (no regression).
- **Verification command**: `npm run test:server`

**Documentation updates**: None beyond the tool's own `description`
field.
