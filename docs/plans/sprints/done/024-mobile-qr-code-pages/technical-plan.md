---
status: draft
from-architecture-version: null
to-architecture-version: null
---

# Sprint 024 Technical Plan

## Architecture Overview

This sprint adds a mobile-optimized frontend layer (`/qr/` routes) that
consumes existing backend APIs. The only backend changes are:

1. OAuth redirect preservation (session `returnTo` field).
2. Label service QR URL prefix update.

No new database tables, migrations, or service methods are needed — the
mobile pages use the same transfer, notes, and image APIs that the
desktop UI uses.

```
Phone camera → /qr/k/:id → QrKitPage (mobile React)
                                ↓
                    /api/kits/:id (existing)
                    /api/transfers (existing)
                    /api/notes (existing)
                    /api/images/upload (existing)
```

## Component Design

### Component 1: OAuth Return-To Redirect

**Use Cases**: SUC-024-001

**Files**:
- `server/src/routes/auth.ts` — modify Google OAuth initiation and callback

**Design**:
- Before redirecting to Google, store `req.query.returnTo` (or
  `req.headers.referer`) in `req.session.returnTo`.
- In the OAuth callback, after `req.login()`, redirect to
  `req.session.returnTo || '/'` and clear it from the session.
- The QR pages' "Sign in" button links to
  `/api/auth/google?returnTo=/qr/k/413` (URL-encoded).
- Validate `returnTo` is a relative path (starts with `/`) to prevent
  open redirect attacks.

**Session type update** (`server/src/types/express-session.d.ts` or
equivalent):
```typescript
declare module 'express-session' {
  interface SessionData {
    returnTo?: string;
  }
}
```

### Component 2: QR Mobile Page Shell

**Use Cases**: SUC-024-001

**Files**:
- `client/src/pages/qr/QrLayout.tsx` — minimal mobile layout (no sidebar)
- `client/src/pages/qr/QrKitPage.tsx` — kit QR page
- `client/src/pages/qr/QrPackPage.tsx` — pack QR page
- `client/src/pages/qr/QrComputerPage.tsx` — computer QR page
- `client/src/App.tsx` — add `/qr/*` routes

**Design**:
- No `AppLayout` wrapper — these are standalone mobile pages.
- Layout: full-width, no sidebar, large touch targets.
- Header: item name + number prominently displayed.
- Photo: if item has an image, show it (capped height).
- Status bar: current custodian, site, disposition as badges.
- Action buttons: large, full-width, stacked vertically.
- "View full details" link at bottom → desktop page.

**Shared component**: `QrItemPage` handles the common pattern:
1. Fetch item data from API.
2. Check auth state.
3. Show sign-in prompt if unauthenticated.
4. Render item info + action buttons.

### Component 3: Check In / Check Out Actions

**Use Cases**: SUC-024-002, SUC-024-003

**Files**:
- `client/src/pages/qr/actions/CheckOutAction.tsx`
- `client/src/pages/qr/actions/CheckInAction.tsx`

**Check Out flow**:
1. POST `/api/transfers` with `{ objectType, objectId, custodianId: currentUser.id }`.
2. Show confirmation toast/banner.
3. Refresh item data.

**Check In flow**:
1. Request `navigator.geolocation.getCurrentPosition()`.
2. Fetch `/api/sites` and compute distance to each site with lat/lng.
3. If nearest site is within ~500m, pre-select it and show confirmation.
4. If no close match, show a simple site picker.
5. POST `/api/transfers` with `{ objectType, objectId, siteId, custodianId: null }`.
6. Show confirmation.

**Geolocation utility** (`client/src/lib/geo.ts`):
```typescript
function haversineDistance(lat1, lon1, lat2, lon2): number // meters
function findNearestSite(coords, sites): { site, distance }
```

### Component 4: Issue Reporting

**Use Cases**: SUC-024-004

**Files**:
- `client/src/pages/qr/actions/ReportIssueAction.tsx`

**Design**:
- Expandable text area with "Report Issue" button.
- POST `/api/notes` with `{ objectType, objectId, content, type: 'ISSUE' }`.
- Uses existing notes API and service.

### Component 5: Mobile Photo Capture

**Use Cases**: SUC-024-005

**Files**:
- `client/src/pages/qr/actions/AddPhotoAction.tsx`

**Design**:
- Reuse the upload logic from `PhotoUpload` component.
- `<input type="file" accept="image/*" capture="environment">` to
  prompt camera on mobile.
- Show thumbnail after upload.

### Component 6: Label QR URL Update

**Use Cases**: SUC-024-001

**Files**:
- `server/src/services/label.service.ts` — update `generateQrBuffer`
  and `generateQrDataUri` calls

**Design**:
- Change QR paths from `/k/:id` to `/qr/k/:id` (same for `/p/` and `/c/`).
- Keep existing `/k/:id`, `/p/:id`, `/c/:id` routes working for
  desktop users (they still redirect to detail pages).

## Decisions

1. **Pack QR page — no check-in/check-out.** Packs aren't independently
   transferred. The pack QR page shows pack info, issue reporting, and
   photo capture only. Include a link to the parent kit's QR page for
   check-in/check-out actions.

2. **Geolocation threshold: 500m.** Sites within 500 meters of the user's
   position are auto-suggested for check-in.
