---
id: '003'
title: Computer QR route and QrLanding update
status: done
use-cases:
- SUC-001
depends-on:
- '001'
---

# Computer QR route and QrLanding update

## Description

Add `GET /api/qr/c/:id` to the existing QR router for Computer QR code
lookups. Update `QrLanding.tsx` to handle the `/c/:id` URL pattern.
Add the `/c/:id` route to `App.tsx`.

## Acceptance Criteria

- [x] `GET /api/qr/c/:id` returns computer name, model, and QR data URL (public, no auth)
- [x] `QrLanding.tsx` detects `/c/` prefix and calls the computer QR endpoint
- [x] `App.tsx` has route `/c/:id` pointing to `QrLanding`
- [x] Unauthenticated users see computer info; authenticated users get a link to detail page

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: Add to `tests/server/computers.test.ts` (or a new `qr.test.ts`):
  - `GET /api/qr/c/:id` returns 200 with computer info and QR data URL (no auth required)
  - `GET /api/qr/c/:id` returns 404 for nonexistent computer
- **Verification command**: `npm run test:server` and `cd client && npx tsc --noEmit`
