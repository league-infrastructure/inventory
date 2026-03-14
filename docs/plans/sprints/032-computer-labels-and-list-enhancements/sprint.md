---
id: "032"
title: "Computer Labels and List Enhancements"
status: planning
branch: sprint/032-computer-labels-and-list-enhancements
use-cases:
  - SUC-001
  - SUC-002
  - SUC-003
  - SUC-004
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Sprint 032: Computer Labels and List Enhancements

## Goals

Design and implement a dedicated computer label format (89mm × 28mm) with
a QR-code-forward layout showing machine name, credentials, and serial
number. Add print-label actions to both the computer detail page and the
computer list page. Enable batch label printing via checkbox selection on
the computer list. Add a sortable "Last Updated" column to the computer
list so recently managed machines surface at the top.

## Problem

The existing label system uses a single 59×102mm Dymo format for kits,
packs, and computers. Computer labels need a different, smaller format
(89mm × 28mm) that shows computer-specific information: machine name,
username/password, and serial number. There is currently no way to print
a label from the computer detail page, and no way to batch-select
computers from the list to print multiple labels at once. The computer
list also lacks a "Last Updated" column, making it hard to find recently
managed machines.

## Solution

1. **New computer label format** — 89mm × 28mm with horizontal layout:
   full-height QR code on the left, org header with flag icon and contact
   info on the right top, machine name in large font, username/password
   below that, and serial number in small text at the bottom.

2. **Print label from computer detail** — Add a "Print Label" button to
   the computer detail page that generates and opens the new-format label
   PDF.

3. **Print label from computer list** — Add a "Print Label" action for
   individual computers on the list page.

4. **Batch label printing** — Add checkboxes to each row in the computer
   list. When one or more boxes are checked, show a floating action button
   to print labels for all selected computers in a single PDF.

5. **Last Updated column** — Add a sortable "Last Updated" column to the
   computer list showing `updatedAt`, so users can sort by most recently
   modified.

## Success Criteria

- Computer labels print at 89mm × 28mm with the specified layout
- QR code is full-height on the left side of the label
- Label shows: org name, URL, phone, machine name, username/password,
  serial number
- "Print Label" button works from computer detail page
- Individual "Print Label" action works from computer list
- Checkbox selection on computer list enables batch printing
- Batch PDF contains one label per page for each selected computer
- "Last Updated" column displays on computer list and is sortable
- Sorting by Last Updated puts recently modified computers at the top

## Scope

### In Scope

- New 89mm × 28mm label PDF generation for computers
- Label layout: QR (left, full-height), header row (flag + org + contact),
  machine name (large), username/password, serial number (small)
- Print label button on computer detail page
- Print label action on computer list (single)
- Checkbox column on computer list for multi-select
- Floating/sticky "Print Labels" button when checkboxes are selected
- Batch PDF generation for multiple computer labels
- "Last Updated" column on computer list (sortable)
- Consuming the existing TODO for sortable last-updated column (computer
  portion)

### Out of Scope

- Changing the existing kit/pack label format
- "Last Updated" column on the kit list (separate TODO scope)
- Label preview/HTML rendering for the new format
- New label stock procurement (hardware concern)

## Test Strategy

- Unit tests for the new label PDF generation (verify dimensions, content
  placement, multi-label PDF)
- Integration tests for the new/modified API endpoints
- Manual testing of the print workflow end-to-end
- Verify the computer list checkbox/batch-print UX

## Architecture Notes

- Extends `LabelService` with a new `generateComputerLabel89x28()` method
- New PDF page size: 89mm × 28mm (landscape)
- Reuses existing QR code generation infrastructure
- Adds a new batch endpoint for computer labels (separate from kit batch)
- Computer list changes: add checkbox column, selection state, floating
  action bar
- `updatedAt` field already exists in the Computer Prisma model — just
  needs to be included in the list API response and rendered in the UI

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, architecture)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
