---
id: '003'
title: Print Label Button on Computer Detail Page
status: in-progress
use-cases:
- SUC-001
depends-on:
- '002'
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Print Label Button on Computer Detail Page

## Description

Add a "Print Label" button to the computer detail page. When clicked,
it calls `GET /api/labels/computer/:id/compact` and opens the PDF in
a new browser tab for printing.

The button should be placed near the existing QR code display area,
consistent with the kit detail page's "Print Labels" button placement.

## Files to Modify

- `client/src/pages/computers/ComputerDetail.tsx` — Add print label button

## Acceptance Criteria

- [ ] "Print Label" button appears on the computer detail page
- [ ] Button uses a Printer icon (from Lucide) consistent with kit labels
- [ ] Clicking the button opens the compact label PDF in a new tab
- [ ] Button is only visible to Quartermaster users
- [ ] Button works correctly (PDF loads and is printable)

## Testing

- **Existing tests to run**: `npm test`
- **New tests to write**: Verify button renders for Quartermaster role,
  verify correct API URL is constructed
- **Verification command**: `npm test`
