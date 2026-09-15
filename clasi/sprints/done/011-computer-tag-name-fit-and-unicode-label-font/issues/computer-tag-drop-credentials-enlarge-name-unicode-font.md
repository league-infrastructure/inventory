---
status: in-progress
sprint: '011'
tickets:
- 011-001
- 011-002
---

# Computer tags: drop credentials, fit the name to the freed box, print Unicode names

## Description

Stakeholder request (2026-09-15), about the compact 89x28mm computer tag
(`addCompactLabelContent` / `generateComputerLabel89x28` /
`buildComputerBundle` in server/src/services/label.service.ts):

> "Computer tags have a username and password on them. We don't need any
> more, so we can just remove that. Move the name down. You can make the
> name a little bigger... Remove the username and password. Reuse that
> area as the box that you're going to put the computer name in, and then
> you're just going to resize the name to fit that box, either height or
> width."

Current layout (right-hand column, beside the QR code): header (flag, org
name, contact line) → machine name (Helvetica-Bold, 22/17/14pt stepped by
character count) → `user: X  pass: Y` line (12pt) → info line (`#kit  OS
SN: serial`, 6pt).

### 1. Remove credentials and resize the name

- Remove the `user: … pass: …` line from every rendering of the computer
  tag (single-computer PDF, batch/bundle PDF including generate_labels,
  and any HTML or client-side variant that prints it).
- The machine name gets a box: everything between the header's bottom and
  the info line's top (the space the name and credential lines use today),
  full width of the text column.
- Render the name as large as possible while fitting that box: choose the
  largest font size where the text fits both the box width and the box
  height on one line, then position it inside the box (vertically centered
  is a sensible default). Short names get noticeably bigger than today;
  long names shrink to fit rather than wrapping or overflowing.
- Keep the QR code, header, and info line where they are. Keep the info
  line at the bottom of the label.
- Credentials stay in the database and in exports; this only changes what
  is printed on the tag.

### 2. Names outside the basic Latin character set print correctly

Host name "Erdős" prints as "Erd 0". Cause: every label PDF uses PDFKit's
built-in Helvetica / Helvetica-Bold, which only encode WinAnsi. "ő"
(U+0151) is outside WinAnsi, so PDFKit emits a malformed glyph code and the
viewer renders junk. Reproduced locally with pdfkit 0.17.2.

- Bundle a Unicode TTF font with a permissive license in the server (e.g.
  Liberation Sans or Arimo, regular and bold — metric-compatible with
  Helvetica so existing layouts don't shift), register it, and use it for
  all label PDFs (kit, pack, computer, both sizes), not only the computer
  tag.
- Make sure the font files ship in the Docker image (docker/Dockerfile.server)
  and resolve correctly from both `src` (ts-node/tests) and `dist`.
- "Erdős" must render as "Erdős" on the computer tag.

## Verification

- Render sample tags to PNG (pdftoppm is available locally) for a short
  name ("Aho"), a typical one ("Erdős"), and a long one ("Papadimitriou",
  "WTS IM 05"), and visually confirm fit, no credentials, and correct
  diacritics.
- Automated tests: credentials absent from the compact tag text; the name's
  chosen size fits the box for short and long names; a non-WinAnsi name
  round-trips (e.g. text extraction or glyph check).
