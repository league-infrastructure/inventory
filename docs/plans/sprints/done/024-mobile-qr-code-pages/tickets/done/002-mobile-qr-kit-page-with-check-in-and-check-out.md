---
id: '002'
title: Mobile QR kit page with check-in and check-out
status: done
use-cases:
- SUC-024-001
- SUC-024-002
- SUC-024-003
depends-on:
- '001'
---

# Mobile QR kit page with check-in and check-out

## Description

Build the primary mobile QR page for kits — the most-used QR page.
Shows kit info and provides one-tap check-in/check-out with geolocation.

## Tasks

1. **QrKitPage component** (`client/src/pages/qr/QrKitPage.tsx`):
   - Fetch kit data from `/api/kits/:id`.
   - Display: kit name, number, photo (if any), current custodian,
     current site, disposition badge.
   - Large, prominent item identity at top.

2. **Check Out action**:
   - "Check Out to Me" button — full-width, large touch target.
   - POST `/api/transfers` with `objectType: 'Kit'`, `objectId`,
     `custodianId: currentUser.id`.
   - Show confirmation banner after success.
   - Optional: "Check Out to..." secondary action with user picker.

3. **Check In action**:
   - "Check In Here" button.
   - Request geolocation, match to nearest site using `findNearestSite()`.
   - If within 500m, show "Check in to [Site]?" with confirm button.
   - If no close match, show site dropdown.
   - POST `/api/transfers` with `siteId`, `custodianId: null`.

4. **Transfer action** (secondary):
   - Simple form: site picker + optional custodian picker.

5. **"View Full Details" link** at bottom → `/kits/:id`.

## Acceptance Criteria

- [ ] Kit QR page displays item info on mobile screen
- [ ] One-tap self-checkout works and creates transfer record
- [ ] One-tap check-in uses geolocation to suggest nearest site
- [ ] Fallback site picker shown when no close site match
- [ ] Transfer action available as secondary option
- [ ] Link to desktop detail page present

## Testing

- **Existing tests to run**: `npm run test:server` (transfer API)
- **Verification command**: `cd client && npx tsc --noEmit`
