---
id: '001'
title: OAuth returnTo redirect and QR route setup
status: done
use-cases:
- SUC-024-001
depends-on: []
---

# OAuth returnTo redirect and QR route setup

## Description

Fix the OAuth login flow to preserve the original URL through
authentication. Add the `/qr/*` route structure in the React router
and create a minimal QR layout shell (no sidebar, mobile-optimized).
Create the geolocation utility for use by later tickets.

## Tasks

1. **Server — session returnTo field**:
   - In `server/src/routes/auth.ts`, capture `req.query.returnTo` before
     redirecting to Google OAuth. Store it in `req.session.returnTo`.
   - In the OAuth callback, redirect to `req.session.returnTo || '/'`
     after login. Clear the field. Validate it starts with `/` to prevent
     open redirects.
   - Update session type declaration to include `returnTo?: string`.

2. **Client — QR route structure**:
   - Add routes in `App.tsx`: `/qr/k/:id`, `/qr/p/:id`, `/qr/c/:id`.
   - Create `client/src/pages/qr/QrLayout.tsx` — minimal mobile shell
     (no sidebar, full-width, centered content).
   - Create placeholder pages that fetch `/api/auth/me` and show
     sign-in prompt (with `returnTo` param) or item info.

3. **Geolocation utility**:
   - Create `client/src/lib/geo.ts` with `haversineDistance()` and
     `findNearestSite()` functions.

## Acceptance Criteria

- [ ] OAuth login preserves returnTo URL through the full redirect flow
- [ ] After login from a QR page, user returns to that QR page
- [ ] `/qr/k/:id`, `/qr/p/:id`, `/qr/c/:id` routes render without AppLayout
- [ ] returnTo is validated as a relative path (no open redirect)
- [ ] Geolocation utility created with haversine distance calculation

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: API test for OAuth returnTo redirect
- **Verification command**: `cd server && npx tsc --noEmit && cd ../client && npx tsc --noEmit`
