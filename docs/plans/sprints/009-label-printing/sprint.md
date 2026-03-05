---
id: "009"
title: "Label Printing"
status: planning
branch: sprint/009-label-printing
use-cases:
  - UC-4.8
---

# Sprint 009: Label Printing

## Goals

Implement PDF label generation for Kits, Packs, and Computers in multiple
label formats, including batch printing for an entire Kit.

## Problem

Every Kit, Pack, and Computer needs a physical label with a QR code. These
labels need to be printed in specific sizes for specific label stock
(Dymo, Avery). Currently there is no way to generate them.

## Solution

- Label PDF generation endpoint that accepts an object type, ID, and
  label format, and returns a downloadable PDF.
- Four label formats:
  - Kit label: 59mm x 102mm (Dymo large shipping)
  - Pack label — large: 59mm x 102mm
  - Pack label — small: Avery 30334
  - Computer label: TBD size, orange durable material
- All labels include: League name, logo, contact URL, phone number, item
  name/ID, QR code.
- Computer labels additionally include: host name, serial number, default
  username/password.
- Batch printing: select a Kit → "Print all labels" → PDF with Kit label
  plus all Pack labels, with option to select a subset.

## Success Criteria

- Quartermaster can generate a label PDF for any Kit, Pack, or Computer.
- Labels render correctly at the specified dimensions.
- QR codes on labels scan correctly and resolve to the right URL.
- Batch print for a Kit produces a multi-page PDF with all labels.
- Labels are downloadable and print correctly on the target label stock.

## Scope

### In Scope

- Label PDF generation for all four formats (UC-4.8)
- Batch label printing for a Kit and its Packs
- Subset selection for batch printing
- Label preview in the UI

### Out of Scope

- Label printing hardware integration (users print via browser/OS)
- Custom label design tool

## Test Strategy

- Backend API tests: PDF generation endpoint, correct dimensions, QR code
  content.
- Visual verification: manual check of generated PDFs against label stock.
- Frontend tests: label format selection, batch print UI.

## Architecture Notes

- PDF generation via a Node.js library (e.g., `pdfkit`, `pdf-lib`, or
  `puppeteer` for HTML-to-PDF).
- QR codes rendered into the PDF using the same generation logic from
  sprint 004.
- Label dimensions must exactly match the physical label stock.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
