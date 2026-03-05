---
id: '005'
title: ServiceRegistry and route migration
status: pending
use-cases:
  - SUC-003
depends-on:
  - '004'
---

# ServiceRegistry and route migration

## Description

Create the ServiceRegistry composition root and migrate all route
files to factory functions that receive it. This is the ticket where
the application switches from old standalone functions to the new
class-based services.

### ServiceRegistry (`server/src/services/ServiceRegistry.ts`)

- Private constructor receives `PrismaClient`
- Constructs services in dependency order:
  1. AuditService (no service deps)
  2. QrService (no service deps)
  3. All domain services (receive prisma, audit, and optionally qr)
- Static `create(prisma?)` factory defaults to the singleton client
- All service properties are `readonly`

### Route migration

Each business route file changes from:
```typescript
import * as xService from '../services/xService';
export const xRouter = Router();
```
To:
```typescript
export function xRouter(services: ServiceRegistry): Router {
  const router = Router();
  // routes use services.x.method()
  return router;
}
```

### index.ts update

`server/src/index.ts` creates the registry at startup and passes it
to each route factory function.

### Round-trip test update

`tests/server/round-trip.test.ts` imports from the new class-based
service modules (or uses ServiceRegistry) instead of the old
standalone function modules.

### Files changed

- NEW: `server/src/services/ServiceRegistry.ts`
- MODIFIED: `server/src/routes/sites.ts`
- MODIFIED: `server/src/routes/computers.ts`
- MODIFIED: `server/src/routes/hostnames.ts`
- MODIFIED: `server/src/routes/kits.ts`
- MODIFIED: `server/src/routes/packs.ts`
- MODIFIED: `server/src/routes/items.ts`
- MODIFIED: `server/src/routes/checkouts.ts`
- MODIFIED: `server/src/routes/qr.ts`
- MODIFIED: `server/src/index.ts`
- MODIFIED: `tests/server/round-trip.test.ts`

Auth, admin, and test auth routes are NOT migrated.

## Acceptance Criteria

- [ ] ServiceRegistry class with static `create()` factory method
- [ ] All business route files are factory functions receiving ServiceRegistry
- [ ] `server/src/index.ts` creates registry and wires route factories
- [ ] Round-trip test updated to use new service classes
- [ ] All existing API tests pass
- [ ] Round-trip test passes
- [ ] No route files import old standalone service modules

## Testing

- **Existing tests to run**: `npm run test:server` — all tests must pass
- **Round-trip test**: `npm run test:server -- --testPathPattern round-trip`
