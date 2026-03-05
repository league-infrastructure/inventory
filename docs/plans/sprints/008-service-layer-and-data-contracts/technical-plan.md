---
status: approved
from-architecture-version: null
to-architecture-version: null
---

# Sprint 008 Technical Plan

## Architecture Overview

This sprint restructures the backend from routes-call-Prisma to a
three-layer architecture:

```
Routes (HTTP adapters)
  → Services (business logic + Prisma)
    → Contracts (TypeScript types for wire format)
```

Routes become thin: parse request, call service, return result, catch
errors. Services own all database access and business rules. Contracts
define the canonical JSON shapes.

## Component Design

### Component: Service Error Types

**Use Cases**: SUC-001

**File**: `server/src/services/errors.ts`

```typescript
class ServiceError extends Error { statusCode: number }
class NotFoundError extends ServiceError     // → 404
class ValidationError extends ServiceError   // → 400
class ConflictError extends ServiceError     // → 409
```

Route error handler catches ServiceError and maps to HTTP status.

### Component: Data Contracts

**Use Cases**: SUC-002

**Directory**: `server/src/contracts/`

| File | Types |
|------|-------|
| `site.ts` | SiteRecord, CreateSiteInput, UpdateSiteInput |
| `computer.ts` | ComputerRecord, ComputerDetailRecord, CreateComputerInput, UpdateComputerInput |
| `hostName.ts` | HostNameRecord, CreateHostNameInput |
| `kit.ts` | KitRecord, KitDetailRecord, CreateKitInput, UpdateKitInput |
| `pack.ts` | PackRecord, CreatePackInput, UpdatePackInput |
| `item.ts` | ItemRecord, CreateItemInput, UpdateItemInput |
| `checkout.ts` | CheckoutRecord, CreateCheckoutInput, CheckinInput |
| `user.ts` | UserRecord |
| `index.ts` | Re-exports all |

### Component: Service Modules

**Use Cases**: SUC-001

**Directory**: `server/src/services/`

| Service File | Key Functions |
|-------------|---------------|
| `siteService.ts` | listSites, getSite, createSite, updateSite, deactivateSite, findNearestSite |
| `computerService.ts` | listComputers, getComputer, createComputer, updateComputer, changeDisposition |
| `hostNameService.ts` | listHostNames, createHostName, deleteHostName |
| `kitService.ts` | listKits, getKit, createKit, updateKit, retireKit, cloneKit |
| `packService.ts` | listPacks, getPack, createPack, updatePack, deletePack |
| `itemService.ts` | listItems, createItem, updateItem, deleteItem |
| `checkoutService.ts` | checkOut, checkIn, listCheckouts, getCheckoutHistory |
| `userService.ts` | findOrCreateUser, getUser |

Existing services (prisma.ts, auditLog.ts, qrCode.ts, config.ts,
logBuffer.ts) remain unchanged — they are already proper services.

### Component: Route Migration

**Use Cases**: SUC-001

Every route file is rewritten to follow this pattern:

```typescript
router.post('/endpoint', requireAuth, async (req, res, next) => {
  try {
    const result = await someService.create(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});
```

The error handler middleware maps ServiceError to HTTP status codes.

Routes to migrate:
- `sites.ts` (6 endpoints)
- `computers.ts` (5 endpoints)
- `hostnames.ts` (3 endpoints)
- `kits.ts` (6 endpoints)
- `packs.ts` (5 endpoints)
- `items.ts` (4 endpoints)
- `checkouts.ts` (4 endpoints)
- `qr.ts` (3 endpoints)

Auth routes, admin routes, health route, and test auth routes are
NOT migrated (they don't contain business logic).

### Component: Error Handler Update

**Use Cases**: SUC-001

**File**: `server/src/middleware/errorHandler.ts`

Add ServiceError handling before the generic 500 handler:

```typescript
if (err instanceof ServiceError) {
  return res.status(err.statusCode).json({ error: err.message });
}
```

### Component: Round-Trip Test Harness

**Use Cases**: SUC-003

**Files**:
- `tests/fixtures/inventory-seed.json` — fixture data
- `tests/db/round-trip.test.ts` — import → export → compare test

The fixture contains a realistic inventory: 2 sites, 3 host names,
3 computers, 2 kits with packs and items. Import creates all records
through the service layer. Export reads them back. Deep comparison
verifies field-by-field equality (ignoring auto-generated IDs and
timestamps).

### Component: Documentation

**Use Cases**: SUC-004

**Files**:
- `AGENTS.md` — add service layer rule
- `docs/contracts.md` — document all contract types

## Testing

- Existing API tests (`tests/server/`) must continue passing
- Round-trip test validates service layer correctness
- grep check: no `from '@prisma/client'` or `from '../services/prisma'`
  imports in route files after migration

## Open Questions

None — all resolved in sprint planning.
