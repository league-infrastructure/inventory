---
id: '004'
title: Issue reporting and photo capture on QR pages
status: done
use-cases:
- SUC-024-004
- SUC-024-005
depends-on:
- '002'
- '003'
---

# Issue reporting and photo capture on QR pages

## Description

Add issue reporting and photo capture actions to all three QR page types.
These are secondary actions below the primary buttons.

## Tasks

1. **ReportIssueAction component** (`client/src/pages/qr/actions/ReportIssueAction.tsx`):
   - "Report Issue" button that expands a text area.
   - Submit creates a note via POST `/api/notes` with
     `{ objectType, objectId, content, type: 'ISSUE' }`.
   - Confirmation message after submission. Collapse form on success.

2. **AddPhotoAction component** (`client/src/pages/qr/actions/AddPhotoAction.tsx`):
   - "Add Photo" button.
   - `<input type="file" accept="image/*" capture="environment">` to
     prompt phone camera.
   - Upload via POST `/api/images/upload` with FormData.
   - Show thumbnail after successful upload.

3. **Integrate into all QR pages**:
   - Add both actions to QrKitPage, QrPackPage, QrComputerPage.
   - Position below the primary actions.

## Acceptance Criteria

- [ ] Issue reporting works on all three QR page types
- [ ] Photo capture opens camera on mobile devices
- [ ] Uploaded photo appears as thumbnail on page
- [ ] Issue notes visible in desktop detail page
- [ ] Photos visible in desktop detail page

## Testing

- **Existing tests to run**: `npm run test:server` (notes and images APIs)
- **Verification command**: `cd client && npx tsc --noEmit`
