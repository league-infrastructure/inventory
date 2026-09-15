---
id: '011'
title: Computer Tag Name Fit and Unicode Label Font
status: done
branch: sprint/011-computer-tag-name-fit-and-unicode-label-font
use-cases:
- SUC-001
- SUC-002
issues:
- computer-tag-drop-credentials-enlarge-name-unicode-font.md
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Sprint 011: Computer Tag Name Fit and Unicode Label Font

## Goals

- Remove the student username/password from the compact 89x28mm computer
  tag everywhere it renders, and let the machine name fill the freed
  space, auto-sized to the largest font that fits the box on one line
  (both width and height).
- Fix Unicode names (e.g. "Erdős") rendering as garbage on label PDFs by
  bundling a Unicode-capable, Helvetica-metric-compatible TTF font and
  using it for all label PDFs, including in the Docker image.

## Problem

The compact computer tag prints `user: X  pass: Y` credentials that are
no longer needed and crowd the machine name into a small, fixed-size
slot. Separately, every label PDF (kit, pack, computer, both sizes) uses
PDFKit's built-in Helvetica/Helvetica-Bold, which only encodes WinAnsi —
any host name with a character outside that set (e.g. "ő" in "Erdős")
renders as a malformed glyph ("Erd 0") instead of the correct character.
See `clasi/issues/computer-tag-drop-credentials-enlarge-name-unicode-font.md`
for the stakeholder's verbatim request, current layout, and root-cause
detail.

## Solution

1. Drop the credentials line from the compact computer tag in
   `label.service.ts` (`addCompactLabelContent` /
   `generateComputerLabel89x28` / `buildComputerBundle`) and any other
   rendering path (single PDF, batch/bundle PDF including
   generate_labels, HTML/client-side variants). Reclaim that vertical
   space plus the existing name line as one box, full width of the text
   column, between the header and the info line.
2. Auto-size the machine name to the largest font that fits the box on
   one line, in both dimensions — short names get noticeably larger,
   long names shrink rather than wrap or overflow. Vertically center by
   default. Keep QR code, header, and info line positions unchanged.
   Credentials remain in the database and in exports — this is
   print-only.
3. Bundle a permissively-licensed, Helvetica-metric-compatible Unicode
   TTF (e.g. Liberation Sans / Arimo, regular and bold), register it
   with PDFKit, and use it across all label PDFs (kit, pack, computer,
   both sizes) — not just the computer tag. Ship the font files in the
   Docker image (`docker/Dockerfile.server`) and ensure they resolve
   from both `src` (ts-node/tests) and `dist`.

## Success Criteria

- No compact computer tag (single, batch/bundle, HTML/client variant)
  shows a username or password.
- Rendered sample tags for a short name ("Aho"), a typical name
  ("Erdős"), and long names ("Papadimitriou", "WTS IM 05") visually
  confirm: no credentials, name fills the box without overflow or
  wrapping, and diacritics render correctly.
- Automated tests cover: credentials absent from compact tag text; the
  chosen font size fits the box for short and long names; a non-WinAnsi
  name (e.g. containing "ő") round-trips correctly (text extraction or
  glyph check).
- Docker-built server image produces correct Unicode label output.

## Scope

### In Scope

- The compact 89x28mm computer tag layout and all its rendering paths
  (single PDF, batch/bundle PDF, generate_labels, HTML/client-side).
- Font handling for all label PDFs (kit, pack, computer, both sizes),
  including bundling, registration, and Docker image packaging.

### Out of Scope

- Any change to credential storage, exports, or the credentials shown
  in the web UI — this sprint only changes what prints on the tag.
- Kit/pack tag layout changes beyond the font swap (no repositioning of
  QR code, header, or info line).
- Non-label PDF or UI Unicode handling outside the label-rendering path.

## Test Strategy

Detailed in the detail-mode planning pass. Expected shape: unit tests
for font-size selection given box dimensions and name length/width;
snapshot/text-extraction tests confirming credentials are absent and
Unicode glyphs (e.g. "Erdős") render correctly; a manual/visual check
rendering sample tags to PNG (pdftoppm) for short, typical, and long
names; and a Docker-build smoke test confirming bundled fonts resolve
from the built image.

## Architecture

**Sizing: Compact.** This sprint changes one existing module
(`server/src/services/label.service.ts`): it reworks the compact
computer-tag layout and adds Unicode font registration used by that
same module's PDF rendering. No new module is introduced, no
cross-module dependency is added or changed (callers —
`server/src/routes` and the `generate_labels` MCP tool — keep calling
the same three exported methods with unchanged signatures), and there
is no data-model change. The one build-time concern (shipping font
files in the Docker image) is a packaging detail of this module's new
asset dependency, not a new architectural component — it is captured
under Migration Concerns below. No diagrams are warranted: there is
nothing new being composed between components, only an existing
module's internals and its build packaging changing.

### What Changed

- **`label.service.ts` — compact tag layout.** `addCompactLabelContent`
  drops its `credentials: string | null` parameter entirely (it becomes
  a two-line layout: header, then one auto-sized name box, then the
  info line). The `ComputerPageRecord` interface drops `credentials`.
  The three call sites that currently build the `user: X  pass: Y`
  string — `generateComputerLabel89x28`, `generateComputerBatchLabels`,
  and the 89x28 branch inside `generateLabelSet` — stop constructing
  it. (These three call sites independently duplicate the same
  credentials-string template today; removing all three closes that
  duplication rather than leaving two dead copies.) A new
  `fitNameToBox`-style helper picks the largest font size (bounded by
  configured min/max) whose rendered width and height both fit the
  reclaimed box — the vertical span from the header's bottom to the
  info line's top, full text-column width — checked against the
  longest word for width the same way `addLabelContent`'s existing
  name-shrink loop already does for the 102×59 label, so the two
  auto-sizing code paths share the same approach even though they
  aren't merged into one function this sprint.
- **`label.service.ts` — Unicode font.** A Helvetica-metric-compatible
  TTF (Liberation Sans, regular + bold) ships under
  `server/src/assets/fonts/`, is registered with `PDFDocument` via
  `doc.registerFont(...)`, and replaces every `'Helvetica'` /
  `'Helvetica-Bold'` string used across `addLabelContent` (kit/pack
  102×59) and `addCompactLabelContent` (computer 89×28) — both label
  sizes, not just the computer tag. The HTML batch-label path
  (`renderLabelHtml`/`generateBatchHtml`) is unaffected: it renders
  kit/pack labels only (browser-side, using CSS `font-family`), never
  the compact computer tag, and browsers already handle Unicode in
  system fonts — no change needed there.
- **`docker/Dockerfile.server`** gains a `COPY` step for the new
  `server/src/assets/fonts/` directory into the built image, alongside
  the existing `dist`/`prisma`/`node_modules` copies, so the registered
  font resolves at runtime the same way it does from `src` under
  ts-node/jest.

### Design Rationale

- **Decision**: Use Liberation Sans (regular + bold) as the bundled
  Unicode font, metric-compatible with Helvetica.
  **Context**: PDFKit's built-in Helvetica only encodes WinAnsi;
  non-WinAnsi characters (e.g. "ő" in "Erdős") render as malformed
  glyphs.
  **Alternatives considered**: (a) Arimo — also Helvetica-metric-
  compatible, Google-maintained, permissive license; functionally
  interchangeable with Liberation Sans for this purpose. (b) A CJK-
  capable font — rejected as speculative generality; no CJK names are
  in scope. (c) Per-glyph fallback (keep Helvetica, substitute a
  Unicode font only for out-of-range characters) — rejected as
  needless complexity when a single metric-compatible Unicode font
  covers every case.
  **Why this choice**: Liberation Sans and Arimo are equivalent for
  this need (both metric-compatible with Helvetica, both permissively
  licensed); Liberation Sans is used as the concrete pick to avoid
  further bikeshedding — either satisfies the requirement.
  **Consequences**: Existing layouts (widths computed against
  Helvetica metrics) do not shift, since the substitute font matches
  Helvetica's advance widths.
- **Decision**: Name box vertical alignment defaults to centered; font
  size bounds default to min 10pt / max 28pt for the compact tag name.
  **Context**: The issue asks for "vertically centered is a sensible
  default" and leaves min/max unspecified.
  **Alternatives considered**: Top-aligned (rejected — looks
  disconnected from a QR code that's vertically centered on the same
  row); no minimum (rejected — an unbounded shrink could produce an
  illegibly small name for a pathological long name, worse than
  wrapping).
  **Why this choice**: Centered matches the QR code's existing
  vertical centering; 10pt matches the label's existing smallest text
  size elsewhere (the info line's neighbors), and 28pt is comfortably
  larger than today's 22pt max stepped size, satisfying "short names
  get noticeably bigger" without dwarfing the box.
  **Consequences**: A pathologically long name (beyond what 10pt fits
  on one line) is not explicitly handled by this decision — flagged as
  an open question below.

### Migration Concerns

- **Docker image packaging**: `docker/Dockerfile.server` must gain an
  explicit `COPY` for the new font asset directory, or the built image
  silently falls back to no registered font (PDFKit throwing, or
  silently reverting to Helvetica, depending on how the registration
  call is guarded) — the same class of gap that already exists for
  `flag.png` (`FLAG_IMAGE_PATH`, currently not copied into the image;
  pre-existing, out of this sprint's scope, but worth the same fix
  pattern being applied consistently to fonts here).
- **No data migration.** Credentials remain in the database and
  exports unchanged — only PDF rendering changes.
- **Deployment sequencing**: none beyond the normal image rebuild;
  this is a pure rendering-layer change with no API or schema impact,
  so no coordinated rollout step is needed.

## Use Cases

Sized to the compact tier: brief, sprint-level use cases rather than
full narrative treatment. Both extend the existing UC-018
("Quartermaster Prints Kit and Pack Labels" — the umbrella print-labels
use case; its error-flow text already references "the batch
computer-label endpoint," so computer-tag printing is treated as
within its scope even though its main flow illustrates kit/pack).

### SUC-001: Computer tag prints without credentials, name fills the box
Parent: UC-018

- **Actor**: Quartermaster
- **Preconditions**: A computer with a host name (and, incidentally,
  stored credentials) exists.
- **Main Flow**:
  1. Quartermaster generates a compact 89×28mm computer tag (single tag,
     batch bundle, or via the `generate_labels` MCP tool).
  2. The tag renders header, QR code, and info line unchanged; the
     freed area between header and info line becomes one box holding
     only the machine name.
  3. The name renders at the largest font size (10-28pt) that fits the
     box on one line in both width and height, vertically centered.
- **Postconditions**: No credentials appear anywhere on the printed
  tag. Short names render noticeably larger than before; long names
  shrink to fit rather than wrapping or overflowing.
- **Acceptance Criteria**:
  - [ ] No rendering path (single PDF, batch/bundle PDF,
        `generate_labels` MCP tool) prints `studentUsername` or
        `studentPassword`.
  - [ ] Name font size is chosen per-name (not a fixed step) to be the
        largest size fitting the box width and height.
  - [ ] QR code, header, and info line positions are unchanged.

### SUC-002: Label names with non-WinAnsi characters render correctly
Parent: UC-018

- **Actor**: Quartermaster / anyone viewing a printed or scanned label
- **Preconditions**: A kit, pack, or computer name contains a character
  outside WinAnsi (e.g. "ő" in "Erdős").
- **Main Flow**:
  1. Quartermaster generates any label PDF (kit/pack 102×59 or computer
     89×28, single or batch).
  2. The label is rendered using the bundled Unicode font instead of
     PDFKit's built-in Helvetica.
- **Postconditions**: The name renders with correct glyphs (e.g.
  "Erdős", not "Erd 0"). This holds identically whether the server runs
  from `src` (ts-node/jest) or from the compiled `dist` inside the
  Docker image.
- **Acceptance Criteria**:
  - [ ] "Erdős" renders correctly (verified via text extraction or
        rendered-PNG glyph check) on the computer tag.
  - [ ] Kit/pack 102×59 labels also use the Unicode font (not just the
        computer tag).
  - [ ] A Docker-built server image produces the same correct glyph
        output as running from source.

## GitHub Issues

(GitHub issues linked to this sprint's tickets. Format: `owner/repo#N`.)

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning document is complete (sprint.md, including its
      Architecture and Use Cases sections)
- [ ] Architecture review passed (or skipped, for changes with no
      architectural impact)
- [ ] Stakeholder has approved the sprint plan

## Tickets

| # | Title | Depends On |
|---|-------|------------|
| 001 | Bundle and register a Unicode-capable font for all label PDFs | — |
| 002 | Drop credentials from the compact computer tag and auto-size the name to fill the box | 001 |

Tickets execute serially in the order listed. Ticket 001 lands first
because ticket 002's name-fit-to-box measurement must be taken against
the final registered font's metrics (Liberation Sans), not Helvetica's.
