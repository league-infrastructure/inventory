---
id: '001'
title: "LabelService.generateLabelSet \u2014 cross-kit resolution, stock splitting,\
  \ unit tests"
status: done
use-cases:
- SUC-001
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

- [x] `LabelService.generateLabelSet(selection: LabelSelection): Promise<LabelBundle[]>`
      exists, where `LabelSelection = { kitIds?, packIds?, computerIds?,
      includeKitPacks? }` and `LabelBundle = { stock, pdf, labelCount,
      contents }` as specified in the issue.
- [x] Packs are resolved individually (`prisma.pack.findUnique({ where:
      { id }, include: { kit: { select: { number: true } } } })`), not by
      filtering a single kit's `packs` array — packs from two different
      kits requested together land in one `102x59` bundle with correct
      `kitNumber/displayNumber` captions matching today's caption format
      (`label.service.ts:479`).
- [x] `includeKitPacks: true` expands to every pack belonging to each
      named kit and dedupes against any explicitly-listed `packIds` for
      the same pack (a pack named both ways appears once).
- [x] Output is grouped by stock size: kit and pack labels always land in
      a `102x59` bundle; computer labels always land in an `89x28` bundle;
      a selection producing both returns two bundles, never one PDF with
      mixed page sizes.
- [x] A bundle is omitted entirely (not returned as an empty PDF) when its
      stock size has no labels in the selection.
- [x] Within each bundle, ordering is stable: kit labels by kit `number`,
      then pack labels by (kit number, `displayNumber`), then computer
      labels by host name.
- [x] An unknown kit/pack/computer ID throws `NotFoundError` naming that
      specific ID, consistent with existing behavior at `label.service.ts:418`
      and `:455`.
- [x] The page-emit loops currently inline in `generateBatchLabels`
      (`label.service.ts:447`) and `generateComputerBatchLabels` (`:401`)
      are extracted into private builders that accept already-resolved
      records and return a `Buffer`. All existing per-label drawing
      helpers (`addLabelContent`, `addCompactLabelContent`,
      `buildInfoLine`, `generateQrBuffer`, `createDoc`,
      `createCompactDoc`) are reused unchanged.
- [x] `generateBatchLabels` and `generateComputerBatchLabels` become thin
      wrappers over the new private builders; their existing signatures,
      return types, and observable output are unchanged.
- [x] **Regression baseline**: before making any change to
      `generateBatchLabels`, capture a baseline PDF from
      `POST /api/labels/kit/:id/batch-pdf` for a fixed, existing kit with
      packs. After the refactor, generate the same PDF again and diff it
      byte-for-byte against the baseline. They must match. Record how the
      baseline was captured (e.g., a small script or curl command) so it
      is reproducible if this needs to be re-verified.

      **How it was done**: rather than driving the real Express app +
      session auth over HTTP for a `curl POST .../batch-pdf` round trip
      (`routes/labels.ts`'s handler is a one-line pass-through to
      `services.labels.generateBatchLabels`, so this adds no coverage
      the direct call doesn't), a one-off script
      (`server/src/tmp-baseline-capture.ts`, run via `npx ts-node
      src/tmp-baseline-capture.ts <out-file>` from `server/`, deleted
      after use — not committed) called `generateBatchLabels(kitId,
      packIds, true)` directly against a fixed kit+2-packs fixture in the
      test DB, once before the extraction and once after, each in its
      own freshly-started process. Diffing the two PDFs byte-for-byte
      showed they were identical except for pdfkit's own per-render
      `/CreationDate` and `/ID` fields (a timestamp and content hash
      pdfkit embeds on every render regardless of caller code — confirmed
      non-deterministic even across two calls to the unmodified,
      pre-refactor method). This is the evidence the extraction was
      behavior-preserving. See
      `tests/server/services/label.service.test.ts`'s "generateBatchLabels
      regression baseline" describe block for the automated structural
      regression test (page count / QR path order / caption order) kept
      in the permanent suite, and for why a raw byte-diff assertion isn't
      used there (a second, unrelated pdfkit non-determinism — internal
      PDF object numbering shifts depending on what else runs in the same
      Jest worker process — would make that flaky).
- [x] `npm run test:server` passes.

      All `label.service.test.ts` tests (27) pass, including every new
      `generateLabelSet` case and the regression checks above. The full
      suite has 8 pre-existing, unrelated failing suites
      (`app.test.ts`, `auth.test.ts`, `github.test.ts`, `pike13.test.ts`,
      `integrations.test.ts`, `services/issue.service.test.ts`,
      `services/token.service.test.ts`, `tokens.test.ts`) — OAuth stub
      routing and test-DB schema/env drift, documented in
      `clasi/issues/server-test-suite-preexisting-failures-and-stale-test-db-config.md`
      and confirmed present before this ticket's changes; none touch
      `LabelService` or this ticket's files.

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
