---
id: '001'
title: "LabelService.generateLabelSet — cross-kit resolution, stock splitting,\
  \ unit tests"
status: open
use-cases: [SUC-001]
depends-on: []
github-issue: ''
issue: mcp-label-generation-for-arbitrary-sets-of-computers-kits-and-packs.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# LabelService.generateLabelSet — cross-kit resolution, stock splitting, unit tests

## Description

Add a single, selection-based entry point to `LabelService` that resolves
kits, packs (from any kit), and computers by explicit ID, groups the
resulting labels by physical stock size, and renders one PDF per stock
size present in the selection. This unblocks cross-kit pack selection,
which is impossible today because `generateBatchLabels` filters `packIds`
against one kit's own `kit.packs` (`label.service.ts:470`). This ticket is
foundational: the MCP tool in ticket 002 calls only this new method, and
nothing about tool registration, auth, or response shaping belongs here.

## Acceptance Criteria

- [ ] `LabelService.generateLabelSet(selection: LabelSelection): Promise<LabelBundle[]>`
      exists, where `LabelSelection = { kitIds?, packIds?, computerIds?,
      includeKitPacks? }` and `LabelBundle = { stock, pdf, labelCount,
      contents }` as specified in the issue.
- [ ] Packs are resolved individually (`prisma.pack.findUnique({ where:
      { id }, include: { kit: { select: { number: true } } } })`), not by
      filtering a single kit's `packs` array — packs from two different
      kits requested together land in one `102x59` bundle with correct
      `kitNumber/displayNumber` captions matching today's caption format
      (`label.service.ts:479`).
- [ ] `includeKitPacks: true` expands to every pack belonging to each
      named kit and dedupes against any explicitly-listed `packIds` for
      the same pack (a pack named both ways appears once).
- [ ] Output is grouped by stock size: kit and pack labels always land in
      a `102x59` bundle; computer labels always land in an `89x28` bundle;
      a selection producing both returns two bundles, never one PDF with
      mixed page sizes.
- [ ] A bundle is omitted entirely (not returned as an empty PDF) when its
      stock size has no labels in the selection.
- [ ] Within each bundle, ordering is stable: kit labels by kit `number`,
      then pack labels by (kit number, `displayNumber`), then computer
      labels by host name.
- [ ] An unknown kit/pack/computer ID throws `NotFoundError` naming that
      specific ID, consistent with existing behavior at `label.service.ts:418`
      and `:455`.
- [ ] The page-emit loops currently inline in `generateBatchLabels`
      (`label.service.ts:447`) and `generateComputerBatchLabels` (`:401`)
      are extracted into private builders that accept already-resolved
      records and return a `Buffer`. All existing per-label drawing
      helpers (`addLabelContent`, `addCompactLabelContent`,
      `buildInfoLine`, `generateQrBuffer`, `createDoc`,
      `createCompactDoc`) are reused unchanged.
- [ ] `generateBatchLabels` and `generateComputerBatchLabels` become thin
      wrappers over the new private builders; their existing signatures,
      return types, and observable output are unchanged.
- [ ] **Regression baseline**: before making any change to
      `generateBatchLabels`, capture a baseline PDF from
      `POST /api/labels/kit/:id/batch-pdf` for a fixed, existing kit with
      packs. After the refactor, generate the same PDF again and diff it
      byte-for-byte against the baseline. They must match. Record how the
      baseline was captured (e.g., a small script or curl command) so it
      is reproducible if this needs to be re-verified.
- [ ] `npm run test:server` passes.

## Implementation Plan

**Approach**: Extract before adding. First pull the existing per-kit /
per-computer-batch page-emit logic out of `generateBatchLabels` and
`generateComputerBatchLabels` into two private methods that take resolved
records (not IDs) and return a `Buffer`. Verify the regression baseline
matches at this point — the extraction alone must be behavior-preserving.
Then add `generateLabelSet` as the new selection-resolving entry point
that calls those same private builders after resolving/deduping/ordering
IDs into records. This order keeps the risky part (touching code three
existing callers depend on) isolated from the purely additive part.

**Files to modify**:
- `server/src/services/label.service.ts` — add `LabelSelection`,
  `LabelBundle` types; extract two private builders; add
  `generateLabelSet`; convert `generateBatchLabels` /
  `generateComputerBatchLabels` to thin wrappers.

**Files to create**:
- `tests/server/services/label.service.test.ts` (or extend an existing
  services test file if one already covers `LabelService` — check
  `tests/server/services/` first) — unit tests for `generateLabelSet`
  per the Testing section below.

**Testing plan**:
- **Existing tests to run**: `npm run test:server` (full suite, to catch
  any regression in `tests/server/labels.test.ts` or elsewhere that
  exercises `LabelService`).
- **New tests to write** (in `tests/server/services/`):
  - Packs from two different kits in one `generateLabelSet` call produce
    one `102x59` bundle with both packs present and correctly captioned.
  - A selection with both `kitIds`/`packIds` and `computerIds` returns
    exactly two bundles with the right `stock` values.
  - A computer-only selection returns exactly one `89x28` bundle.
  - `includeKitPacks: true` expands correctly and dedupes against an
    explicitly-listed `packIds` entry for a pack already in that kit.
  - An unknown ID (kit, pack, or computer) throws `NotFoundError` naming
    that ID.
  - A selection with no labels at all (empty `kitIds`/`packIds`/
    `computerIds`, `includeKitPacks` irrelevant) — decide and document the
    expected behavior at the service layer (an empty array of bundles is
    acceptable here; the empty-selection *user-facing error* belongs in
    ticket 002's MCP tool guard, not this service method).
  - Regression: baseline vs. post-refactor PDF byte comparison for
    `generateBatchLabels` on a fixed kit.
- **Verification command**: `npm run test:server`

**Documentation updates**: None required — `LabelService` has no
standalone API doc; its public contract is the TypeScript method
signature itself, and inline comments in the issue's code sketch
(reproduced in the sprint's Architecture section) already describe intent
for the next reader.
