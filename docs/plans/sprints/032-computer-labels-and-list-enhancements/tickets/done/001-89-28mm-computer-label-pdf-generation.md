---
id: '001'
title: "89\xD728mm Computer Label PDF Generation"
status: done
use-cases:
- SUC-001
depends-on: []
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# 89×28mm Computer Label PDF Generation

## Description

Add new label generation methods to `LabelService` that produce an
89mm × 28mm computer label with the following layout:

- **Left**: Full-height QR code (~28×28mm) linking to `/c/{computerId}`
- **Right top**: Flag icon + "The League Of Amazing Programmers"
- **Below org name**: jointheleague.org (858) 284-0481
- **Large font**: Machine name (hostname, falling back to model or ID)
- **Normal font**: Username and password
- **Small font**: Serial number

Also add a batch method that generates a multi-page PDF with one label
per page for an array of computer IDs.

## Files to Modify

- `server/src/services/label.service.ts` — Add `generateComputerLabel89x28()`
  and `generateComputerBatchLabels()` methods

## Acceptance Criteria

- [ ] New method `generateComputerLabel89x28(computerId)` generates a PDF
      with 89mm × 28mm page dimensions
- [ ] QR code renders full-height on the left side
- [ ] Flag icon renders in the header area
- [ ] Org name, URL, and phone number render in the header
- [ ] Machine name renders in large font
- [ ] Username and password render below machine name
- [ ] Serial number renders in small text at the bottom
- [ ] Missing fields are handled gracefully (omitted, not "null")
- [ ] Batch method `generateComputerBatchLabels(computerIds)` generates
      multi-page PDF with one label per page
- [ ] Empty computerIds array returns an error

## Testing

- **Existing tests to run**: `npm test`
- **New tests to write**: Unit tests for the new label methods — verify
  PDF buffer is generated, correct page dimensions, handles missing
  fields gracefully
- **Verification command**: `npm test`
