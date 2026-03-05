---
id: "003"
title: "Item CRUD API"
status: done
use-cases:
  - SUC-003
  - SUC-004
depends-on:
  - "002"
---

# Item CRUD API

## Description

Create Item CRUD API routes. Items belong to a Pack and represent
individual components (COUNTED with expected quantities, or CONSUMABLE).

## Acceptance Criteria

- [x] `GET /api/packs/:packId/items` returns all Items in a Pack, requires auth
- [x] `POST /api/packs/:packId/items` creates an Item with name, type, and expectedQuantity; requires Quartermaster
- [x] `PUT /api/items/:id` updates Item fields; requires Quartermaster
- [x] `DELETE /api/items/:id` deletes an Item; requires Quartermaster
- [x] Validation: name required; type must be COUNTED or CONSUMABLE
- [x] COUNTED items must have an expectedQuantity > 0
- [x] CONSUMABLE items ignore expectedQuantity
- [x] All mutations write to the audit log
- [x] Returns 404 if Pack or Item not found

## Testing

- **Existing tests to run**: `cd server && npx tsc --noEmit`
- **New tests to write**: API tests for Item CRUD, type validation
- **Verification command**: `cd server && npx tsc --noEmit`
