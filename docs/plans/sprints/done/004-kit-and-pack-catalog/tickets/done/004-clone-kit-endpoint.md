---
id: "004"
title: "Clone Kit endpoint"
status: done
use-cases:
  - SUC-005
depends-on:
  - "001"
  - "002"
  - "003"
---

# Clone Kit endpoint

## Description

Add a `POST /api/kits/:id/clone` endpoint that duplicates a Kit's full
Pack and Item structure into a new Kit with new IDs and QR codes.
Computers are NOT cloned (they are unique physical devices).

## Acceptance Criteria

- [x] `POST /api/kits/:id/clone` creates a new Kit with " (Copy)" appended to the name
- [x] All Packs from the source Kit are duplicated with new IDs and QR codes
- [x] All Items within each Pack are duplicated with new IDs
- [x] Computers assigned to the source Kit are NOT included in the clone
- [x] The cloned Kit is assigned to the same Site as the original
- [x] Audit log records the clone operation
- [x] Returns 404 if source Kit not found
- [x] Requires Quartermaster role

## Testing

- **Existing tests to run**: `cd server && npx tsc --noEmit`
- **New tests to write**: Clone endpoint test verifying hierarchy duplication, QR code uniqueness, no Computer duplication
- **Verification command**: `cd server && npx tsc --noEmit`
