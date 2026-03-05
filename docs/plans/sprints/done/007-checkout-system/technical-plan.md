---
status: approved
from-architecture-version: null
to-architecture-version: null
---

# Sprint 007 Technical Plan

## Architecture Overview

This sprint adds checkout/check-in functionality. The Checkout model
already exists in the Prisma schema. We need:

1. **Backend**: Checkout API endpoints (check-out, check-in, list,
   nearest-site)
2. **Frontend**: Checkout UI on kit detail page, checked-out kits
   list page, QR landing page checkout detection
3. **Testing**: API tests for checkout flows

## Component Design

### Component: Checkout API Routes

**Use Cases**: SUC-001, SUC-002, SUC-003

**File**: `server/src/routes/checkouts.ts`

**Endpoints**:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/checkouts | requireAuth | Check out a kit |
| PATCH | /api/checkouts/:id/checkin | requireAuth | Check in a kit |
| GET | /api/checkouts | requireAuth | List open checkouts |
| GET | /api/checkouts/history/:kitId | requireAuth | Checkout history for a kit |
| POST | /api/sites/nearest | requireAuth | Find nearest site by GPS |

**Check-out request body**:
```json
{
  "kitId": 1,
  "destinationSiteId": 2
}
```

**Check-in request body**:
```json
{
  "returnSiteId": 3
}
```

**Nearest site request body**:
```json
{
  "latitude": 37.7749,
  "longitude": -122.4194
}
```

**Validation rules**:
- Kit must exist and be ACTIVE
- Kit must not have an open checkout (check-out)
- Kit must have an open checkout (check-in)
- Destination/return site must exist and be active
- Any authenticated user can check out/in (not QM-only)

### Component: Frontend Checkout UI

**Use Cases**: SUC-001, SUC-002

**Changes to existing files**:

1. **KitDetail.tsx**: Add checkout/check-in section
   - If kit has open checkout: show checkout info + "Check In" button
   - If kit is available: show "Check Out" button
   - GPS location request on button click
   - Site selector with GPS-suggested default

2. **QrLanding.tsx**: After login redirect, kit detail page handles
   checkout state (no changes needed to QrLanding itself)

**New files**:

3. **CheckedOutList.tsx**: Page showing all currently checked-out kits
   - Table with: kit name, user, destination site, checkout time
   - Clickable rows navigate to kit detail
   - Available to all authenticated users

### Component: Sidebar Navigation Update

**File**: `client/src/components/AppLayout.tsx`

Add "Checked Out" nav item visible to all authenticated users.

### Component: Nearest Site Calculation

**File**: `server/src/routes/sites.ts` (add endpoint)

Haversine formula to find nearest active site given lat/lng
coordinates. Returns the closest site with distance in km.

## Testing

- `tests/server/checkouts.test.ts`: Checkout/check-in API tests
  - Create checkout, verify 201
  - Prevent double checkout (409)
  - Check in, verify record updated
  - List open checkouts
  - Nearest site calculation

## Open Questions

None — all resolved in sprint planning.
