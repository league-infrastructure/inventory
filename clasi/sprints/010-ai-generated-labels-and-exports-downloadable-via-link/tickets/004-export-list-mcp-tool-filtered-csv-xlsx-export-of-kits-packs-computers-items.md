---
id: '004'
title: 'export_list MCP tool: filtered CSV/xlsx export of kits, packs, computers,
  items'
status: open
use-cases: [SUC-003]
depends-on: ['001', '002']
github-issue: ''
issue: ai-generated-labels-and-exports-downloadable-via-link.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# export_list MCP tool: filtered CSV/xlsx export of kits, packs, computers, items

## Description

There is currently no MCP tool for "give me a list of X", even though
`ExportService` already has the query logic (today only as an
unfiltered, six-entity, JSON/XLSX-only dump reachable from
`/api/export`, `/api/export/json`). Add a new `export_list` MCP tool
that produces a single-entity CSV or xlsx for kits, packs, computers,
or items, honoring the same filters the corresponding `list_*` MCP
tool already accepts, using human identifiers only (kit numbers, pack
designators, host names — never database ids in the output file),
consistent with sprint 009's convention. Extend `ExportService` to
support this rather than duplicating its query/mapping logic in
`tools.ts`.

Per sprint.md's Impact section: the existing `exportToJson`/
`exportToExcel` (full, unfiltered, REST-only) are unchanged and keep
serving `/api/export`/`/api/export/json` — this ticket adds new methods
alongside them, it does not refactor the existing ones.

## Acceptance Criteria

- [ ] `ExportService` gains a filtered, single-entity export capable of
      CSV or xlsx output, for each of: kits (filter: `status`, matching
      `list_kits`), packs (filter: `kit_number`, matching `list_packs`),
      items (filter: `pack` designator, matching `list_items`),
      computers (filters: `site_id`, `kit_number`, `disposition`,
      `unassigned`, matching `list_computers`). Row shape mirrors the
      corresponding entity's existing full-export column mapping in
      `exportToExcel` (e.g. `kitNumber`/`kitName` instead of raw ids) —
      do not introduce a second, inconsistent column naming scheme.
      CSV output may use `ExcelJS`'s single-sheet CSV writer (no new
      dependency needed).
- [ ] New `export_list` MCP tool in `server/src/mcp/tools.ts`: inputs
      `entity` (`'kits'|'packs'|'computers'|'items'`), `format`
      (`'csv'|'xlsx'`), plus that entity's filter fields (all optional,
      omitting all filters returns the full unfiltered list for that
      entity — same "omit means everything" convention as the `list_*`
      tools).
- [ ] The tool resolves human-facing filter values the same way the
      corresponding `list_*` tool does (e.g. `kit_number` →
      `resolveKitByNumber`, `pack` → `resolvePackByDesignator`) — no
      raw database ids in the tool's own input schema either.
- [ ] Stores the resulting file via `GeneratedFileService.store` and
      returns a JSON text block with `download_url`, row count, and the
      entity/format echoed back.
- [ ] No database id column appears in the generated CSV/xlsx for any
      entity (verified by asserting the output header row against an
      explicit allowlist of human-facing column names per entity).
- [ ] Same access level as the existing `/api/export` REST routes: any
      authenticated non-loanee MCP user, no additional quartermaster
      restriction (per sprint.md's explicit security-consistency note —
      this does not change who can already see computer credential
      fields via the existing full export, it adds a second,
      filtered path to the same data under the same guard).

## Testing

- **Existing tests to run**: `ExportService`'s existing
  `exportToJson`/`exportToExcel` tests must still pass unchanged (they
  are not being refactored).
- **New tests to write**: one test per entity confirming filters
  compose correctly and match the corresponding `list_*` tool's result
  set; a header-row assertion per entity confirming no id column is
  present; a CSV-vs-xlsx format test; an end-to-end test that the
  returned `download_url` resolves (via ticket 002's route) to a file
  whose row count matches the filtered query.
- **Verification command**: `cd server && npx jest --config
  ../tests/server/jest.config.js src/services/export.service src/mcp/tools`.
