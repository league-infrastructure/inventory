---
id: '003'
title: Service layer — sites, hostnames, computers
status: done
use-cases:
  - SUC-001
depends-on:
  - '001'
  - '002'
---

# Service layer — sites, hostnames, computers

## Description

Create service modules for sites, host names, and computers that
encapsulate all database access and business logic. These services
accept contract input types, return contract record types, and throw
typed service errors.

### Files created

- `server/src/services/siteService.ts`
- `server/src/services/hostNameService.ts`
- `server/src/services/computerService.ts`

### siteService functions

- `listSites()` — returns active sites ordered by isHomeSite desc, name asc
- `getSite(id)` — returns a single site or throws NotFoundError
- `createSite(input, userId)` — validates name/lat/lon, creates site, writes audit log
- `updateSite(id, input, userId)` — partial update with diff-based audit
- `deactivateSite(id, userId)` — sets isActive=false with audit
- `findNearestSite(lat, lon)` — haversine distance calculation against active geo-coded sites

### hostNameService functions

- `listHostNames()` — returns all host names with assigned computer summary
- `createHostName(input)` — validates name, checks uniqueness (ConflictError)
- `deleteHostName(id)` — prevents deletion if assigned to a computer

### computerService functions

- `listComputers(filters)` — filter by disposition, siteId, kitId, or unassigned
- `getComputer(id)` — includes hostName, site, kit relations
- `createComputer(input, userId)` — validates foreign keys, generates QR path, optionally assigns hostName
- `updateComputer(id, input, userId)` — partial update with hostName reassignment logic and audit
- `changeDisposition(id, disposition, userId)` — dedicated disposition change with audit

## Acceptance Criteria

- [x] All site CRUD + deactivate + nearest through siteService
- [x] All hostname create/list/delete through hostNameService
- [x] All computer CRUD + disposition change through computerService
- [x] Audit log entries written for all mutations
- [x] Typed errors thrown for not found, validation, and conflict cases
- [x] Foreign key validation (siteId, kitId, hostNameId) in computer creation/update

## Testing

- **Existing tests to run**: `npm run test:server` — site, hostname, and computer API tests
- **Verification**: No Prisma imports in route files for these entities after migration
