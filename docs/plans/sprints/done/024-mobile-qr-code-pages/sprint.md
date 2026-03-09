---
id: '024'
title: Mobile QR Code Pages
status: done
branch: sprint/024-mobile-qr-code-pages
use-cases:
- SUC-024-001
- SUC-024-002
- SUC-024-003
- SUC-024-004
- SUC-024-005
---

# Sprint 024: Mobile QR Code Pages

## Goals

Build mobile-optimized pages for QR code scanning workflows. When a user
scans a printed QR label on a kit, pack, or computer with their phone,
they should land on a touch-friendly page focused on quick actions:
check in/out, transfer, report an issue, or snap a photo.

## Problem

Current QR codes link to `/k/:id`, `/p/:id`, `/c/:id` which redirect to
desktop detail pages. These pages render blank or broken on small screens.
Additionally, the OAuth login flow always redirects to `/`, losing the
original QR context — so after logging in, the user has no way back to the
item they scanned.

## Solution

1. Create new `/qr/k/:id`, `/qr/p/:id`, `/qr/c/:id` routes with
   mobile-first React pages optimized for phone screens.
2. Fix the OAuth redirect flow to preserve and restore the original URL
   through login (session `returnTo` field).
3. Update the `LabelService` to generate QR codes pointing to `/qr/` paths.
4. Implement one-tap check-in/check-out with sensible defaults (check out
   to self, check in to nearest site via geolocation).

## Success Criteria

- Scanning a QR label on a phone opens a usable, touch-friendly page.
- After OAuth login, user returns to the QR page they scanned (not `/`).
- User can check out an item to themselves with one tap.
- User can check in an item to their current site with one tap.
- User can report an issue or snap a photo from the mobile page.
- Existing desktop `/k/:id` short URLs continue working.

## Scope

### In Scope

- Mobile-optimized QR pages for kits, packs, and computers
- OAuth returnTo redirect preservation
- One-tap check-in/check-out actions
- Transfer action (to different site/custodian)
- Issue reporting from mobile
- Photo capture from phone camera
- Update label QR code URLs to `/qr/` prefix
- Geolocation for site matching on check-in

### Out of Scope

- AI chat interface on mobile (QM-only, not needed here)
- Redesigning the full desktop UI for mobile responsiveness
- Push notifications
- Offline/PWA support

## Test Strategy

- Server API tests for the returnTo redirect flow
- E2E tests for the QR page → login → redirect-back flow
- Manual testing on actual phone screens (iOS Safari, Android Chrome)
- API tests for check-in/check-out endpoints

## Architecture Notes

- QR pages are a new set of React routes under `/qr/` — separate from
  the desktop `AppLayout` (no sidebar, no desktop navigation).
- Reuse existing `TransferService` and transfer API endpoints for
  check-in/check-out operations.
- Server-side: add `returnTo` to session, update OAuth callback to use it.
- Client-side: QR pages fetch item data directly from existing API
  endpoints (`/api/kits/:id`, `/api/computers/:id`, etc.).
- Geolocation uses browser `navigator.geolocation` API, matched against
  site lat/lng from the geocoded site addresses (sprint 023).

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

1. **001** — OAuth returnTo redirect and QR route setup
2. **002** — Mobile QR kit page with check-in and check-out
3. **003** — Mobile QR pack and computer pages
4. **004** — Issue reporting and photo capture on QR pages
5. **005** — Update label QR codes to use /qr/ prefix
