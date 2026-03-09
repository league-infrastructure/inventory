---
id: '003'
title: Mobile QR pack and computer pages
status: done
use-cases:
- SUC-024-001
- SUC-024-002
- SUC-024-003
depends-on:
- '002'
---

# Mobile QR pack and computer pages

## Description

Build QR pages for packs and computers. Computer page mirrors kit page
(with check-in/check-out). Pack page is simpler — info, issue reporting,
and photo only, with a link to the parent kit.

## Tasks

1. **QrComputerPage** (`client/src/pages/qr/QrComputerPage.tsx`):
   - Fetch from `/api/computers/:id`.
   - Display: hostname, model, serial, disposition, custodian, site.
   - Check-in/check-out/transfer actions (same as kit page).
   - "View Full Details" link → `/computers/:id`.

2. **QrPackPage** (`client/src/pages/qr/QrPackPage.tsx`):
   - Fetch pack data from `/api/packs/:id`.
   - Display: pack name, parent kit name/number, items list, photo.
   - **No check-in/check-out** — packs aren't independently transferred.
   - Link to parent kit QR page: `/qr/k/:kitId`.
   - "View Full Details" link → `/kits/:kitId`.

3. **Shared QrItemHeader component** — extract common item display
   pattern (name, number, photo, status badges) to reuse across pages.

## Acceptance Criteria

- [ ] Computer QR page shows info with check-in/check-out actions
- [ ] Pack QR page shows info without check-in/check-out
- [ ] Pack page links to parent kit QR page
- [ ] All three pages render correctly on phone-sized screens
- [ ] Shared header component reduces duplication

## Testing

- **Existing tests to run**: `npm run test:server`
- **Verification command**: `cd client && npx tsc --noEmit`
