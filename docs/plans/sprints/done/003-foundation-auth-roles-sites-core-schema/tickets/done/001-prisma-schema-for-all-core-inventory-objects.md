---
id: '001'
title: Prisma schema for all core inventory objects
status: done
use-cases: []
depends-on: []
---

# Prisma schema for all core inventory objects

## Description

Create the Prisma schema models for all core inventory objects: User, Site,
Kit, Pack, Item, Computer, HostName, Checkout, Issue, InventoryCheck, and
AuditLog. Also create the QuartermasterPattern model for storing email
patterns. Generate and run the migration.

This is the foundation ticket — all other tickets depend on these models
existing.

## Acceptance Criteria

- [ ] User model: googleId, email, displayName, avatar, role enum (INSTRUCTOR, QUARTERMASTER), timestamps
- [ ] Site model: name, address, latitude, longitude, isHomeSite, isActive, timestamps
- [ ] Kit model: name, description, siteId (FK), status enum (ACTIVE, RETIRED), qrCode, timestamps
- [ ] Pack model: name, description, kitId (FK), qrCode, timestamps
- [ ] Item model: name, type enum (COUNTED, CONSUMABLE), expectedQuantity, packId (FK), timestamps
- [ ] Computer model: hostname, serialNumber, serviceTag, model, defaultUsername, defaultPassword, disposition enum (ACTIVE, LOANED, NEEDS_REPAIR, IN_REPAIR, SCRAPPED, LOST, DECOMMISSIONED), siteId (FK nullable), kitId (FK nullable), dateReceived, lastInventoried, notes, qrCode, timestamps
- [ ] HostName model: name (unique), computerId (FK nullable), timestamps
- [ ] Checkout model: kitId (FK), userId (FK), destinationSiteId (FK), returnSiteId (FK nullable), checkedOutAt, checkedInAt (nullable)
- [ ] Issue model: type enum (MISSING_ITEM, REPLENISHMENT), status enum (OPEN, RESOLVED), packId (FK), itemId (FK), reporterId (FK), resolverId (FK nullable), notes, resolvedAt, timestamps
- [ ] InventoryCheck model: kitId/packId (FK nullable), userId (FK), timestamp, notes
- [ ] AuditLog model: userId (FK nullable), objectType, objectId, field, oldValue, newValue, source enum (UI, IMPORT, API), timestamp
- [ ] QuartermasterPattern model: pattern (string), isRegex (boolean), timestamps
- [ ] Migration runs successfully with `npx prisma migrate dev`
- [ ] Prisma client generates without errors

## Testing

- **Existing tests to run**: `npm test` in server/ to verify no regressions
- **New tests to write**: Migration applies cleanly; Prisma client can query all new tables
- **Verification command**: `cd server && npx prisma migrate dev --name core-inventory-schema`
