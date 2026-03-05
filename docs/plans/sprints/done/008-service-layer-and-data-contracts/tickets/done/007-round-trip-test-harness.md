---
id: '007'
title: Round-trip test harness
status: done
use-cases:
  - SUC-003
depends-on:
  - '003'
  - '004'
---

# Round-trip test harness

## Description

Build an integration test that validates the service layer by importing
seed data through service functions, exporting it back, and performing
field-by-field comparison to ensure nothing was lost or mutated.

### Files created

- `tests/fixtures/inventory-seed.json` — fixture data covering all domain entities
- `tests/server/round-trip.test.ts` — import/export/compare test

### Fixture data contents

The seed file contains:
- 2 sites (with coordinates and addresses)
- 3 host names
- 3 computers (assigned to sites and host names via index references)
- 2 kits, each with packs and items (both COUNTED and CONSUMABLE types)

Index references (e.g., `siteIndex: 0`) allow the test to map seed data
to created record IDs without hardcoding.

### Test structure

1. **Import phase**: Creates all entities through the service layer in
   dependency order (sites → hostnames → computers → kits → packs → items).
   Adds a timestamp suffix to names for test isolation.

2. **Export phase**: Reads back each entity through service layer get/list
   functions and compares field-by-field against the original seed data.

3. **Cleanup**: Deletes all created records in reverse FK order in
   `afterAll` to avoid polluting the test database.

### Verification checks

- Site fields: name, address, latitude, longitude, isHomeSite, isActive
- Hostname fields: name, computer assignment
- Computer fields: serialNumber, model, notes, siteId, hostName assignment
- Kit fields: name, description, siteId, status, qrCode
- Pack fields: name, description, item count
- Item fields: name, type, expectedQuantity (null for CONSUMABLE)

## Acceptance Criteria

- [x] Fixture file covers sites, hostnames, computers, kits, packs, and items
- [x] Import creates all records through service layer functions
- [x] Export reads all records back through service layer functions
- [x] Field-by-field comparison passes for all entities
- [x] Test cleans up after itself (no test data left in database)
- [x] Test handles concurrent runs via timestamp suffix on names

## Testing

- **Run**: `npm run test:server -- --testPathPattern round-trip`
- **Prerequisite**: Running PostgreSQL database (Docker dev or local)
