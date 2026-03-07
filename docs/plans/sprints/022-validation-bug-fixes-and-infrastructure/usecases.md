---
status: approved
---

# Sprint 022 Use Cases

## SUC-001: Computer creation requires identifying info
- **Actor**: Admin / MCP client
- **Preconditions**: None
- **Main Flow**: Attempt to create computer with no serialNumber, serviceTag, or model
- **Postconditions**: ValidationError returned, no record created
- **Acceptance Criteria**:
  - [ ] Create with no identifying fields returns 400
  - [ ] Create with at least one identifying field succeeds

## SUC-002: Only one home site at a time
- **Actor**: Admin
- **Main Flow**: Set site B as home site when site A is already home
- **Postconditions**: Site A loses isHomeSite, site B gains it
- **Acceptance Criteria**:
  - [ ] Setting isHomeSite auto-clears other sites

## SUC-003: OS duplicate name prevention
- **Actor**: Admin / MCP client
- **Main Flow**: Create OS with name that already exists
- **Postconditions**: ValidationError, not raw Prisma error
- **Acceptance Criteria**:
  - [ ] Duplicate name returns friendly ValidationError
  - [ ] OS CRUD goes through service layer

## SUC-004: Kit site cascades to computers
- **Actor**: Admin
- **Main Flow**: Transfer kit to new site; assign computer to kit
- **Postconditions**: All member computers' siteId matches kit
- **Acceptance Criteria**:
  - [ ] Kit site change cascades to member computers
  - [ ] Computer assignment to kit sets computer siteId
  - [ ] Existing data mismatches fixed
