---
id: '004'
title: Service layer — kits, packs, items
status: done
use-cases:
  - SUC-001
depends-on:
  - '001'
  - '002'
---

# Service layer — kits, packs, items

## Description

Create service modules for kits, packs, and items. These represent the
inventory hierarchy (kit contains packs, packs contain items) and
include multi-step operations like kit cloning.

### Files created

- `server/src/services/kitService.ts`
- `server/src/services/packService.ts`
- `server/src/services/itemService.ts`

### kitService functions

- `listKits(statusFilter?)` — filter by KitStatus enum, includes site summary
- `getKit(id)` — returns KitDetailRecord with nested packs (with items) and computers
- `createKit(input, userId)` — validates name and siteId (must be active), generates QR path, audit
- `updateKit(id, input, userId)` — partial update with diff-based audit
- `retireKit(id, userId)` — sets status=RETIRED, prevents double-retire
- `cloneKit(id, userId)` — deep clone: creates new kit with "(Copy)" suffix, clones all packs and items, generates new QR paths

### packService functions

- `listPacks(kitId)` — packs for a given kit, includes items
- `getPack(id)` — returns PackDetailRecord with items and kit summary
- `createPack(kitId, input, userId)` — validates kit exists, generates QR path
- `updatePack(id, input, userId)` — partial update with audit
- `deletePack(id, userId)` — delete with audit log

### itemService functions

- `listItems(packId)` — items for a given pack
- `createItem(packId, input, userId)` — validates pack exists, type (COUNTED/CONSUMABLE), quantity rules
- `updateItem(id, input, userId)` — partial update with type-aware quantity validation
- `deleteItem(id, userId)` — delete with audit log

### Business rules

- COUNTED items require `expectedQuantity >= 1`
- CONSUMABLE items have `expectedQuantity` set to null
- Kit clone is a deep copy: kit + all packs + all items get new IDs and QR codes

## Acceptance Criteria

- [x] Full kit CRUD + retire + clone through kitService
- [x] Full pack CRUD (scoped to kit) through packService
- [x] Full item CRUD (scoped to pack) through itemService
- [x] Kit clone creates deep copy of entire hierarchy
- [x] Item type validation (COUNTED requires quantity, CONSUMABLE nullifies it)
- [x] Audit log entries written for all mutations

## Testing

- **Existing tests to run**: `npm run test:server` — kit, pack, and item API tests
- **Verification**: No Prisma imports in route files for these entities after migration
