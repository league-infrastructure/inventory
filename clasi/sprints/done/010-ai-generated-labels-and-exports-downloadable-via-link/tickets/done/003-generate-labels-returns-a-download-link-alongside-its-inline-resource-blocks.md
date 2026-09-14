---
id: '003'
title: generate_labels returns a download link alongside its inline resource blocks
status: done
use-cases:
- SUC-001
- SUC-002
depends-on:
- '001'
- '002'
github-issue: ''
issue: ai-generated-labels-and-exports-downloadable-via-link.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# generate_labels returns a download link alongside its inline resource blocks

## Description

Wire the existing `generate_labels` MCP tool
(`server/src/mcp/tools.ts`, ~line 638) to `GeneratedFileService`
(ticket 001) so its JSON manifest includes a real, clickable download
link per PDF bundle — closing the actual gap this sprint exists for
(external MCP clients can't turn a base64 `resource` block into a
download; the in-app chat drops `resource` blocks entirely). The
60-label cap, one-PDF-per-stock-size behavior, and the existing inline
`resource` blocks are all unchanged — this is additive.

## Acceptance Criteria

- [x] For each `LabelBundle` returned by `services.labels.generateLabelSet`,
      the tool stores the PDF via `GeneratedFileService.store` (owner =
      the requesting MCP-context user) and adds a `download_url` field
      to that bundle's entry in the JSON manifest text block (alongside
      the existing `stock`/`labelCount`/`contents` fields).
- [x] The existing per-bundle `resource` content block (base64 PDF) is
      still returned unchanged, for clients that do render it.
- [x] The 60-label cap check and the pre-existing "no labels requested"
      / cap-exceeded error paths are unaffected — they run before any
      storage call, as today.
- [x] `generate_labels`'s tool description is updated to mention that
      the manifest includes a download link per bundle (the model needs
      to know this exists in order to present it — see ticket 006 for
      the broader instruction/prompt update, but this tool's own
      description should not go stale relative to its actual output).
- [x] Stored filenames are human-meaningful (e.g. reflect the stock
      size / contents), not database ids, consistent with sprint 009's
      identifier convention.

## Testing

- **Existing tests to run**: `generate_labels`'s existing tool tests
  (cap enforcement, multi-stock-size splitting, `include_kit_packs`
  dedup) must all still pass unchanged.
- **New tests to write**: assert the manifest's JSON now includes a
  `download_url` per bundle; assert the linked URL, once resolved via
  `GeneratedFileService.resolveForDownload` (or, if ticket 002 is
  already merged, via an actual HTTP call to
  `/api/downloads/:token`), returns bytes identical to the inline
  `resource` block's decoded base64 for the same bundle.
- **Verification command**: `cd server && npx jest --config
  ../tests/server/jest.config.js src/mcp/tools` (or the specific
  `generate_labels` test file).
