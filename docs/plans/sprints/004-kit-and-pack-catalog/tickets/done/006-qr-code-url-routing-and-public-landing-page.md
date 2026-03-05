---
id: "006"
title: "QR code URL routing and public landing page"
status: done
use-cases:
  - SUC-006
depends-on:
  - "005"
---

# QR code URL routing and public landing page

## Description

Add frontend routes for `/k/:id` and `/p/:id` (the QR code URLs) that
redirect authenticated users to Kit/Pack detail pages, or show a public
landing page with a login prompt for unauthenticated users.

## Acceptance Criteria

- [x] `/k/:id` route: if authenticated, redirects to `/kits/:id`; if not, shows public landing
- [x] `/p/:id` route: if authenticated, redirects to `/packs/:id`; if not, shows public landing
- [x] Public landing page (`QrLanding.tsx`) fetches minimal object info from a public API endpoint
- [x] Public landing shows object name/type and "Sign in to view details" button
- [x] Backend: `GET /api/qr/k/:id` and `GET /api/qr/p/:id` return minimal public info (name, type) without auth
- [x] Invalid IDs show a "Not found" message

## Testing

- **Existing tests to run**: `cd client && npx tsc --noEmit`
- **New tests to write**: QR landing component renders correctly for auth and unauth states
- **Verification command**: `cd client && npx tsc --noEmit`
