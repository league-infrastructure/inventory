---
id: '002'
title: Drop credentials from the compact computer tag and auto-size the name to fill
  the box
status: done
use-cases:
- SUC-001
depends-on:
- '001'
github-issue: ''
issue: computer-tag-drop-credentials-enlarge-name-unicode-font.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Drop credentials from the compact computer tag and auto-size the name to fill the box

## Description

The compact 89×28mm computer tag (`addCompactLabelContent` in
`server/src/services/label.service.ts`) currently prints a
`user: X  pass: Y` credentials line below the machine name. The
stakeholder no longer wants credentials on the physical tag (they
remain in the database and exports — this is print-only). This ticket:

1. Removes the credentials line from every rendering path: the single
   tag (`generateComputerLabel89x28`), the batch/bundle path
   (`generateComputerBatchLabels` → `buildComputerBundle`), and the
   `generate_labels` MCP tool's 89×28 branch inside
   `generateLabelSet`. All three currently build an identical
   `user: ${...}  pass: ${...}` string independently — remove all
   three call sites, not just one, and drop the `credentials` field
   from `ComputerPageRecord` and the `credentials` parameter from
   `addCompactLabelContent`.
2. Reclaims the freed vertical space plus the existing name line as
   one box — full text-column width, spanning from the header's bottom
   to the info line's top — and auto-sizes the machine name to the
   largest font (bounded 10-28pt) that fits the box on one line in
   both width and height, vertically centered by default. QR code,
   header, and info line stay exactly where they are today.

Depends on ticket 001 (Unicode font): the box-fit measurement uses
`doc.widthOfString` / `doc.heightOfString` against whatever font is
registered at the time this code runs, so it must be written and
tested against the final Liberation Sans metrics, not Helvetica's —
otherwise the fit calculation would need re-validating once the font
changes underneath it.

No client/UI code needs to change — confirmed no client component
renders credentials as part of a printable label view (only
`ComputerDetail.tsx`'s on-screen, toggleable credentials field, which
is out of scope per the issue).

## Acceptance Criteria

- [x] No compact 89×28 tag rendering path (`generateComputerLabel89x28`,
      `generateComputerBatchLabels`/`buildComputerBundle`, or
      `generateLabelSet`'s 89×28 branch) constructs or prints
      `studentUsername` / `studentPassword` text.
- [x] `addCompactLabelContent`'s `credentials` parameter and
      `ComputerPageRecord.credentials` field are removed (not just
      left unused).
- [x] The machine name renders in a single box spanning from the
      header's bottom to the info line's top, full text-column width.
- [x] The name's font size is chosen per-name as the largest size
      (bounded min 10pt / max 28pt) whose rendered width (checked
      against the full string, since the name is meant to stay on one
      line) and height both fit the box — not the old fixed
      22/17/14pt step function.
- [x] The name is vertically centered in the box by default.
- [x] QR code, header, and info line positions are pixel-for-pixel
      unchanged from before this ticket.
- [x] Short names ("Aho") are visibly larger than the old 22pt cap;
      long names ("Papadimitriou", "WTS IM 05") shrink to fit rather
      than wrapping or overflowing the box.
- [x] Rendered sample PNGs (pdftoppm) for "Aho", "Erdős",
      "Papadimitriou", and "WTS IM 05" visually confirm: no
      credentials, correct fit, correct diacritics (this ticket
      should use the font landed by ticket 001).

## Implementation Plan

**Approach**: In `label.service.ts`, change `addCompactLabelContent`'s
signature to drop `credentials`, and rework the vertical layout so the
box between `headerBottom` and the info line's top is computed first,
then a fit-to-box loop (mirroring the existing shrink-until-fit pattern
in `addLabelContent`, generalized to also check height, not just
longest-word width) picks the largest size in `[10, 28]` where both
`doc.widthOfString(machineName)` and the single-line height fit the
box. Update the three call sites
(`generateComputerLabel89x28`, `generateComputerBatchLabels`,
`generateLabelSet`) to stop building the credentials string and stop
passing it. Update the `ComputerPageRecord` interface and
`buildComputerBundle` accordingly.

**Files to create/modify**:
- `server/src/services/label.service.ts` — `addCompactLabelContent`,
  `ComputerPageRecord`, `generateComputerLabel89x28`,
  `generateComputerBatchLabels`, `generateLabelSet`.

**Testing plan**:
- Update/extend `tests/server/services/label.service.test.ts`: assert
  the compact tag's extracted text never contains the credentials
  string or the literal substrings `user:` / `pass:`; assert a short
  name renders at a larger point size than a long name (via a snapshot
  of the chosen font size, if the implementation exposes it for
  testing, or via measured glyph bounding box); assert the box-fit
  holds for a short name ("Aho"), a typical name ("Erdős"), and long
  names ("Papadimitriou", "WTS IM 05").
- Manual/visual verification: render the same four sample names to PNG
  via `pdftoppm` and visually confirm layout, sizing, and correct
  diacritics.
- Run the full existing label test suite to confirm no regression:
  `cd server && npx jest --config ../tests/server/jest.config.js
  --runInBand --forceExit tests/server/services/label.service.test.ts
  tests/server/labels.test.ts`.

**Documentation updates**: Update `docs/label-spec.md` if it documents
the compact tag's current credentials line or font-size steps.

## Testing

- **Existing tests to run**: `cd server && npx jest --config
  ../tests/server/jest.config.js --runInBand --forceExit
  tests/server/services/label.service.test.ts tests/server/labels.test.ts`
- **New tests to write**: credentials-absence assertion; box-fit
  assertion across short/typical/long names.
- **Verification command**: `cd server && npx jest --config
  ../tests/server/jest.config.js --runInBand --forceExit`
