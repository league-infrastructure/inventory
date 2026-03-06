---
status: draft
---

# Sprint 009 Use Cases

## SUC-001: Base Service Abstraction
Parent: N/A (architectural refactoring)

- **Actor**: Developer / System
- **Preconditions**: Service modules exist as standalone exported functions
- **Main Flow**:
  1. Create abstract BaseService class with generic type parameters
  2. Define template methods for list, get, create, update, delete
  3. Provide protected helpers for validation, record mapping, and audit entry building
  4. Subclasses override template methods with entity-specific logic
- **Postconditions**: All domain services extend BaseService
- **Acceptance Criteria**:
  - [ ] BaseService abstract class exists with generic CRUD template methods
  - [ ] Protected prisma and audit properties accessible to subclasses
  - [ ] Template methods define validate-persist-audit-return pipeline

## SUC-002: Service Class Conversion
Parent: N/A (architectural refactoring)

- **Actor**: Developer / System
- **Preconditions**: Standalone service functions exist for all domain entities
- **Main Flow**:
  1. Convert each service module from exported functions to a class extending BaseService
  2. Move shared state (field lists, include configs) to class properties
  3. Implement entity-specific methods (deactivate, clone, retire, etc.) as class methods
  4. Preserve all existing behavior and return types
- **Postconditions**: All service modules are classes; no standalone service function exports remain
- **Acceptance Criteria**:
  - [ ] SiteService, HostNameService, ComputerService classes created
  - [ ] KitService, PackService, ItemService classes created
  - [ ] CheckoutService class created
  - [ ] All classes extend BaseService
  - [ ] No standalone exported service functions remain

## SUC-003: Dependency Injection and Service Registry
Parent: N/A (architectural refactoring)

- **Actor**: Developer / System
- **Preconditions**: Service classes exist but are not yet wired together
- **Main Flow**:
  1. Create AuditService class wrapping existing audit log functions
  2. Create QrService class merging qrCode.ts and qrService.ts
  3. Create ServiceRegistry as the composition root
  4. ServiceRegistry.create() constructs all services with injected dependencies
  5. Route files become factory functions receiving ServiceRegistry
  6. Update server/src/index.ts to create registry and wire routes
- **Postconditions**: All service construction happens in ServiceRegistry; routes receive services via injection
- **Acceptance Criteria**:
  - [ ] AuditService class wraps writeAuditLog and diffForAudit
  - [ ] QrService class merges generation and entity lookup
  - [ ] ServiceRegistry constructs and wires all services
  - [ ] ServiceRegistry.create() accepts optional PrismaClient for test injection
  - [ ] Route files are factory functions receiving ServiceRegistry
  - [ ] server/src/index.ts creates registry at startup

## SUC-004: Service Layer Tests and Coverage
Parent: N/A (testing)

- **Actor**: Test runner
- **Preconditions**: All service classes exist
- **Main Flow**:
  1. Configure Jest coverage collection for `server/src/services/`
  2. Write direct tests for every service class (no HTTP layer)
  3. Test happy paths and error paths for all public methods
  4. Enforce coverage thresholds in Jest config
  5. Run existing API and round-trip tests to confirm no regressions
- **Postconditions**: Service layer has 85% line coverage; all tests pass
- **Acceptance Criteria**:
  - [ ] Jest coverage configured for services directory
  - [ ] Test files for all service classes (AuditService, QrService, SiteService, HostNameService, ComputerService, KitService, PackService, ItemService, CheckoutService, ServiceRegistry)
  - [ ] 85% line coverage on server/src/services/
  - [ ] 70% branch coverage on server/src/services/
  - [ ] Coverage threshold enforced in Jest config
  - [ ] All existing API tests pass unchanged
  - [ ] Round-trip test passes unchanged
  - [ ] TypeScript compiles with no errors
