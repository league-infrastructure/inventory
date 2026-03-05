---
status: approved
---

# Sprint 008 Use Cases

## SUC-001: Service Layer Extraction
Parent: N/A (architectural refactoring)

- **Actor**: Developer / System
- **Preconditions**: Routes currently call Prisma directly
- **Main Flow**:
  1. Create service modules for each domain entity
  2. Move all Prisma calls from routes into service functions
  3. Service functions accept plain objects, return contract types
  4. Service functions throw typed errors (NotFound, ValidationError, etc.)
  5. Route handlers become thin HTTP adapters
- **Postconditions**: No Prisma imports in route files
- **Acceptance Criteria**:
  - [ ] Service modules created for: sites, computers, hostnames, kits, packs, items, checkouts, users, qr, audit
  - [ ] All route handlers delegate to service functions
  - [ ] Services throw ServiceError subclasses, routes catch and map to HTTP status
  - [ ] No Prisma imports outside server/src/services/

## SUC-002: Data Contracts
Parent: N/A (architectural refactoring)

- **Actor**: Developer / System
- **Preconditions**: No formal type definitions for API responses
- **Main Flow**:
  1. Define TypeScript interfaces for each domain entity's wire format
  2. Define input types for create/update operations
  3. Service functions return these contract types
- **Postconditions**: All API responses conform to documented types
- **Acceptance Criteria**:
  - [ ] Contract interfaces defined for all domain entities
  - [ ] Service functions typed to return contract types
  - [ ] contracts/index.ts re-exports all types

## SUC-003: Round-Trip Test Harness
Parent: N/A (testing infrastructure)

- **Actor**: Test runner
- **Preconditions**: Service layer exists
- **Main Flow**:
  1. Load fixture data from JSON seed file
  2. Import through service layer (create sites, hostnames, computers, kits, packs, items)
  3. Export all data back via service layer
  4. Deep compare exported data to original fixture
- **Postconditions**: Fixture data survives import → export round-trip
- **Acceptance Criteria**:
  - [ ] Fixture file covers all domain entities
  - [ ] Import creates all records through service layer
  - [ ] Export reads all records through service layer
  - [ ] Deep comparison passes
  - [ ] All existing API tests still pass

## SUC-004: Documentation Updates
Parent: N/A (documentation)

- **Actor**: Developer
- **Preconditions**: Service layer implemented
- **Main Flow**:
  1. Add service layer architectural rule to AGENTS.md
  2. Create docs/contracts.md documenting all data contract shapes
- **Postconditions**: Future development follows service layer pattern
- **Acceptance Criteria**:
  - [ ] AGENTS.md documents "no Prisma above service layer" rule
  - [ ] docs/contracts.md documents all contract types
