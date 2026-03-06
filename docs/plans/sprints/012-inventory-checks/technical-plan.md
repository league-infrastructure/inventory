---
status: approved
from-architecture-version: null
to-architecture-version: null
---

# Sprint 012 Technical Plan

## Architecture Overview

Sprint 012 adds inventory verification capability. The existing
InventoryCheck and InventoryCheckLine Prisma models provide the
database layer. This sprint adds:

1. **InventoryCheckService** — service layer for creating, submitting,
   and querying inventory checks
2. **Contracts** — TypeScript types for inventory check records and inputs
3. **Routes** — REST API endpoints for inventory check CRUD
4. **Frontend** — Inventory check UI on kit/pack detail pages

## Component Design

### Component 1: Inventory Check Contract and Service

**Use Cases**: SUC-012-001, SUC-012-002, SUC-012-003, SUC-012-004

- `InventoryCheckRecord` and `InventoryCheckLineRecord` contracts
- `InventoryCheckService` with methods:
  - `startKitCheck(kitId, userId)` — creates check with lines for all
    items and computers in the kit
  - `startPackCheck(packId, userId)` — creates check with lines for
    all items in the pack
  - `submitCheck(checkId, lines, notes, userId)` — updates lines with
    actual values, flags discrepancies, updates computer lastInventoried
  - `getCheck(id)` — returns check with lines
  - `getHistory(kitId?, packId?)` — returns past checks for a kit or pack
- Register in ServiceRegistry

### Component 2: Inventory Check Routes

**Use Cases**: SUC-012-001, SUC-012-002, SUC-012-003, SUC-012-004

- `POST /api/inventory-checks/kit/:kitId` — start a kit check
- `POST /api/inventory-checks/pack/:packId` — start a pack check
- `PATCH /api/inventory-checks/:id` — submit check results
- `GET /api/inventory-checks/:id` — get a check with lines
- `GET /api/inventory-checks/history/kit/:kitId` — kit check history
- `GET /api/inventory-checks/history/pack/:packId` — pack check history
- All routes require authentication

### Component 3: Frontend Inventory Check UI

**Use Cases**: SUC-012-001, SUC-012-002, SUC-012-004

- Add "Inventory Check" button to kit detail page
- Checklist UI showing all items grouped by pack, plus computers
- Quantity inputs for COUNTED items, toggle for CONSUMABLE items
- Computer present/absent checkboxes
- Submit button with optional notes field
- Check history section on kit detail page

## Open Questions

None — the schema is already in place.
