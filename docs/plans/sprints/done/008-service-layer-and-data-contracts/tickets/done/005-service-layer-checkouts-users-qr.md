---
id: '005'
title: Service layer — checkouts, users, QR
status: done
use-cases:
  - SUC-001
depends-on:
  - '001'
  - '002'
---

# Service layer — checkouts, users, QR

## Description

Create service modules for checkouts, and QR code lookup. The existing
`qrCode.ts` service (low-level QR generation) is unchanged; the new
`qrService.ts` handles entity lookup by QR path. The checkout service
wraps the check-out/check-in business logic.

### Files created

- `server/src/services/checkoutService.ts`
- `server/src/services/qrService.ts`

### checkoutService functions

- `checkOut(input, userId)` — validates kit is active and not already checked out, validates destination site is active, creates checkout with audit
- `checkIn(checkoutId, input, userId)` — validates checkout exists and is open, validates return site, records check-in time with audit
- `listCheckouts(status)` — filter by 'open' (checkedInAt is null), 'closed', or 'all'
- `getCheckoutHistory(kitId)` — all checkouts for a specific kit

### qrService functions

- `getKitQrInfo(id)` — returns kit summary + QR data URL
- `getComputerQrInfo(id)` — returns computer summary + QR data URL
- `getPackQrInfo(id)` — returns pack summary + QR data URL

### Business rules

- A kit can only have one open checkout at a time
- Only ACTIVE kits can be checked out
- Destination site must be active
- Already-checked-in checkouts cannot be checked in again

## Acceptance Criteria

- [x] Check-out and check-in through checkoutService with validation
- [x] Checkout listing with open/closed/all filtering
- [x] Kit checkout history retrieval
- [x] QR info lookup for kits, computers, and packs through qrService
- [x] Audit log entries for checkout/checkin operations
- [x] Business rule enforcement (single open checkout, active kit, active site)

## Testing

- **Existing tests to run**: `npm run test:server` — checkout and QR API tests
- **Verification**: No Prisma imports in route files for checkout or QR entities
