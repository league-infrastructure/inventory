---
id: '004'
title: Service layer tests and coverage
status: done
use-cases:
  - SUC-004
depends-on:
  - '003'
---

# Service layer tests and coverage

## Description

Install Jest coverage tooling and write direct unit/integration tests
for every service class. Tests instantiate service classes directly
(via ServiceRegistry or manual construction with the test database
PrismaClient) and exercise their public methods — no HTTP layer
involved.

Target: **85% line coverage** of `server/src/services/` files.

### Coverage setup

- Add `collectCoverageFrom` to jest config targeting `server/src/services/**/*.ts`
- Add `coverageThreshold` enforcing 85% lines on the services directory
- Add `npm run test:coverage` script to `server/package.json`

### Test files

Create `tests/server/services/` directory with one test file per
service class:

| Test file | Service class | Key scenarios |
|-----------|--------------|---------------|
| `AuditService.test.ts` | AuditService | write single entry, write batch, diff detects changes, diff ignores unchanged fields |
| `SiteService.test.ts` | SiteService | list active sites, get by id, get not found, create with validation, update partial fields, deactivate, deactivate already inactive, findNearest |
| `HostNameService.test.ts` | HostNameService | list, create, create duplicate conflict, delete, delete assigned throws |
| `ComputerService.test.ts` | ComputerService | list with filters, get with includes, create with QR generation, create with hostName assignment, update with hostName reassignment, changeDisposition, invalid disposition |
| `KitService.test.ts` | KitService | list with status filter, get detail with packs, create, update, retire, retire already retired, clone deep copy |
| `PackService.test.ts` | PackService | list by kit, get detail, create with QR, update, delete, delete with audit |
| `ItemService.test.ts` | ItemService | list by pack, create COUNTED with quantity, create CONSUMABLE nullifies quantity, update type change, delete |
| `CheckoutService.test.ts` | CheckoutService | checkOut, checkOut already checked out, checkOut inactive kit, checkIn, checkIn already closed, list open/closed/all, getHistory |
| `ServiceRegistry.test.ts` | ServiceRegistry | create() returns all services, services are correct types, create with custom PrismaClient |

### Test patterns

- Each test file creates a `ServiceRegistry` (or individual service)
  against the test database
- Tests create their own test data through the service layer (not
  raw Prisma) and clean up in `afterAll`
- Use timestamp suffixes on names for test isolation (same pattern as
  round-trip test)
- Test both happy paths and error paths (NotFoundError,
  ValidationError, ConflictError)

### Coverage enforcement

```javascript
// in jest config
coverageThreshold: {
  'server/src/services/': {
    lines: 85,
    branches: 70,
    functions: 85,
  }
}
```

## Acceptance Criteria

- [ ] Jest coverage collection configured for `server/src/services/`
- [ ] `npm run test:coverage` script added
- [ ] Test files created for all 9 service classes + ServiceRegistry
- [ ] Tests exercise happy paths and error paths for each public method
- [ ] 85% line coverage on `server/src/services/` achieved
- [ ] 70% branch coverage on `server/src/services/` achieved
- [ ] Coverage threshold enforced in jest config (CI will fail if coverage drops)
- [ ] All tests clean up their own data

## Testing

- **Run**: `npm run test:coverage`
- **Verify**: Coverage report shows >= 85% lines for services directory
