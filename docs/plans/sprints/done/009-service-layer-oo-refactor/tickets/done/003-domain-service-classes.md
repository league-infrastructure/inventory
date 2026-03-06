---
id: '003'
title: Domain service classes
status: done
use-cases:
- SUC-002
depends-on:
- '001'
- '002'
---

# Domain service classes

## Description

Convert all 7 domain service modules from standalone exported functions
into classes extending BaseService. Each class moves existing function
bodies into methods, replaces module-level `prisma` import with
`this.prisma`, and replaces `writeAuditLog`/`diffForAudit` calls with
`this.writeAudit()`/`this.buildAuditEntries()`.

### Classes to create

| Class | File | Extra Constructor Deps |
|-------|------|----------------------|
| SiteService | `SiteService.ts` | — |
| HostNameService | `HostNameService.ts` | — |
| ComputerService | `ComputerService.ts` | QrService |
| KitService | `KitService.ts` | QrService |
| PackService | `PackService.ts` | QrService |
| ItemService | `ItemService.ts` | — |
| CheckoutService | `CheckoutService.ts` | — |

### Per-class details

**SiteService**: list, get, create, update, deactivate, findNearest.
Moves `SITE_FIELDS` and `haversineDistance` to class properties/methods.

**HostNameService**: list, create, delete. Simplest service.

**ComputerService**: list, get, create, update, changeDisposition.
Receives QrService for QR path generation on create. Moves
`COMPUTER_FIELDS` and `COMPUTER_INCLUDES` to class properties.

**KitService**: list, get, create, update, retire, clone. Receives
QrService. Clone is the most complex method — deep copies kit with
packs and items.

**PackService**: list, get, create, update, delete. Receives QrService.
Scoped to a parent kit.

**ItemService**: list, create, update, delete. Scoped to a parent pack.
Item type validation (COUNTED/CONSUMABLE) stays in the class.

**CheckoutService**: checkOut, checkIn, list, getHistory. Business
rules (single open checkout, active kit, active site) stay in class.

### Convention

Files are PascalCase (`SiteService.ts`) matching the class name.

## Acceptance Criteria

- [ ] All 7 domain service classes created extending BaseService
- [ ] Each class defines `entityName` and `auditFields`
- [ ] Entity-specific methods preserved (deactivate, clone, retire, changeDisposition, etc.)
- [ ] Extra dependencies (QrService) injected via constructor
- [ ] Shared state (field lists, include configs) moved to class properties
- [ ] TypeScript compiles successfully
- [ ] Existing tests still pass (old files still present, routes not yet migrated)

## Testing

- **Existing tests to run**: `npm run test:server`
- **Note**: Tests still pass because old service files are still present and routes still import them. This ticket creates the new classes alongside the old files.
