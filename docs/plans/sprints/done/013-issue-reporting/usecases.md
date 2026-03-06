---
status: approved
---

# Sprint 013 Use Cases

## SUC-013-001: Flag Missing Item
Parent: UC-3.1

- **Actor**: Instructor or Quartermaster
- **Preconditions**: Pack exists with items
- **Main Flow**:
  1. User views a pack or kit
  2. User reports a missing item by selecting the item and type MISSING_ITEM
  3. System creates an issue record linked to the pack and item
  4. Issue appears in the issue queue
- **Postconditions**: Issue record created with OPEN status
- **Acceptance Criteria**:
  - [x] Issue created with correct type, pack, and item linkage
  - [x] Reporter recorded
  - [x] Audit log entry created

## SUC-013-002: Flag Consumable Replenishment
Parent: UC-3.2

- **Actor**: Instructor or Quartermaster
- **Preconditions**: Pack exists with consumable items
- **Main Flow**:
  1. User reports a consumable needing replenishment
  2. System creates a REPLENISHMENT issue
- **Postconditions**: Issue record created
- **Acceptance Criteria**:
  - [x] REPLENISHMENT issue created correctly
  - [x] Linked to correct pack and item

## SUC-013-003: Resolve Issue
Parent: UC-3.3

- **Actor**: Quartermaster
- **Preconditions**: Open issue exists
- **Main Flow**:
  1. Quartermaster views open issues
  2. Quartermaster resolves an issue with optional notes
  3. System updates status to RESOLVED with timestamp and resolver
- **Postconditions**: Issue marked resolved
- **Acceptance Criteria**:
  - [x] Issue status updated to RESOLVED
  - [x] Resolver and resolvedAt recorded
  - [x] Audit log entry created
