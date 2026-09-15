---
id: '001'
title: Bundle and register a Unicode-capable font for all label PDFs
status: open
use-cases:
- SUC-002
depends-on: []
github-issue: ''
issue: computer-tag-drop-credentials-enlarge-name-unicode-font.md
completes_issue: false
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Bundle and register a Unicode-capable font for all label PDFs

## Description

Every label PDF (`server/src/services/label.service.ts`) currently uses
PDFKit's built-in `'Helvetica'` / `'Helvetica-Bold'` fonts, which only
encode WinAnsi. Any name containing a character outside that set (e.g.
"ő" in "Erdős") renders as a malformed glyph ("Erd 0"). This ticket
bundles a permissively-licensed, Helvetica-metric-compatible Unicode
TTF (Liberation Sans, regular + bold) into the server, registers it
with PDFKit, and replaces every Helvetica reference across both label
sizes (kit/pack 102×59 via `addLabelContent`, computer 89×28 via
`addCompactLabelContent`) so all PDF label rendering uses it. It also
ensures the font files ship correctly in the Docker server image.

This ticket must land first: ticket 002's name-fit-to-box sizing
measures text with `doc.widthOfString` / `doc.heightOfString`, and
those measurements must be taken against the font that actually ships,
not against Helvetica, or the box-fit will be wrong once this ticket
switches fonts.

The HTML batch-label path (`renderLabelHtml` / `generateBatchHtml`) is
out of scope — it renders kit/pack labels only, never the compact
computer tag, and relies on the browser's own font handling.

## Acceptance Criteria

- [ ] Liberation Sans regular and bold TTF files are added under
      `server/src/assets/fonts/` (or equivalent) with their license
      file, and registered with PDFKit (e.g. via
      `doc.registerFont('LabelSans', ...)` /
      `doc.registerFont('LabelSans-Bold', ...)`).
- [ ] Every `'Helvetica'` / `'Helvetica-Bold'` string used by
      `addLabelContent` and `addCompactLabelContent` (org name, contact
      line, number, name, description, credentials-adjacent info line,
      etc.) is replaced with the registered font names. The HTML label
      path is unchanged.
- [ ] Font file resolution works both when the server runs from `src`
      (ts-node / jest) and from compiled `dist` — no hardcoded
      `src`-relative path that breaks after `tsc` output moves to
      `dist`.
- [ ] `docker/Dockerfile.server` copies the new font asset directory
      into the built image (an explicit `COPY` alongside the existing
      `dist` / `prisma` / `node_modules` copies), so the registered
      font resolves at runtime in the container the same way it does
      locally.
- [ ] A kit/pack (102×59) and a computer (89×28) label containing
      "Erdős" render the correct glyphs — verified via text extraction
      or a rendered-PNG glyph check (pdftoppm) — not "Erd 0" or similar
      mangling.
- [ ] Existing label layouts (widths/positions computed against
      Helvetica metrics) are visually unchanged for ASCII names, since
      Liberation Sans matches Helvetica's advance widths.

## Implementation Plan

**Approach**: Vendor Liberation Sans (regular + bold TTF) under
`server/src/assets/fonts/`. In `label.service.ts`, register both faces
once (e.g. in the constructor or a module-level helper invoked before
first use, matching how `FLAG_IMAGE_PATH` already resolves an asset
path relative to `__dirname`) and swap every `.font('Helvetica')` /
`.font('Helvetica-Bold')` call to the registered names. Update
`docker/Dockerfile.server` with a `COPY --from=server-builder
/app/src/assets/fonts ./dist/assets/fonts`-style line (matching the
existing asset-copy pattern used for `src/prompts` → `dist/prompts`).

**Files to create/modify**:
- `server/src/assets/fonts/LiberationSans-Regular.ttf`,
  `LiberationSans-Bold.ttf` (new), plus license file.
- `server/src/services/label.service.ts` — font registration and
  Helvetica → registered-font replacement.
- `docker/Dockerfile.server` — add font asset COPY step.

**Testing plan**:
- New unit/integration test in
  `tests/server/services/label.service.test.ts` (or a new
  `label.service.fonts.test.ts`) asserting a label containing "Erdős"
  extracts/renders the correct glyphs, for both label sizes.
- Manual/visual verification: render sample PDFs to PNG via
  `pdftoppm` for "Aho", "Erdős", "Papadimitriou" and visually confirm
  correct diacritics and unchanged layout for ASCII names.
- Run the full existing label test suite to confirm no regression:
  `cd server && npx jest --config ../tests/server/jest.config.js
  --runInBand --forceExit tests/server/services/label.service.test.ts
  tests/server/labels.test.ts`.

**Documentation updates**: Note the bundled font and its license in
`docs/label-spec.md` if that doc enumerates rendering details.

## Testing

- **Existing tests to run**: `cd server && npx jest --config
  ../tests/server/jest.config.js --runInBand --forceExit
  tests/server/services/label.service.test.ts tests/server/labels.test.ts`
- **New tests to write**: Unicode glyph round-trip test(s) for both
  label sizes (kit/pack 102×59 and computer 89×28), covering at least
  "Erdős".
- **Verification command**: `cd server && npx jest --config
  ../tests/server/jest.config.js --runInBand --forceExit`
