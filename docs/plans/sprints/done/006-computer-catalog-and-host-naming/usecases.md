---
status: complete
---

# Sprint 006 Use Cases

## SUC-001: Create a Computer
Parent: UC-4.3

- **Actor**: Quartermaster
- **Preconditions**: Quartermaster is logged in. At least one Site exists.
- **Main Flow**:
  1. Quartermaster navigates to Computer list and clicks "Add Computer".
  2. Fills in: serial number, service tag, model, default credentials,
     date received, notes.
  3. Selects a disposition (defaults to Active).
  4. Optionally selects a host name from the available pool.
  5. Optionally assigns the Computer to a Kit or a Site.
  6. Submits the form.
  7. System creates the Computer, generates a QR code, and writes an
     audit log entry.
- **Postconditions**: Computer exists with a QR code. If a host name was
  selected, it is now assigned. Audit log records the creation.
- **Acceptance Criteria**:
  - [x] Computer is created with all required fields
  - [x] QR code is generated and stored
  - [x] Host name assignment is optional and works correctly
  - [x] Audit log entry is written

## SUC-002: View and Edit a Computer
Parent: UC-4.3

- **Actor**: Quartermaster
- **Preconditions**: Computer exists.
- **Main Flow**:
  1. Quartermaster navigates to Computer detail page.
  2. Views all attributes, current host name, current assignment (Kit or
     Site), QR code, and disposition.
  3. Clicks "Edit" to modify any field.
  4. Saves changes.
  5. System updates the Computer and writes an audit log entry for each
     changed field.
- **Postconditions**: Computer is updated. Audit log records all changes.
- **Acceptance Criteria**:
  - [x] Detail page shows all Computer attributes
  - [x] Edit form pre-fills current values
  - [x] Only changed fields generate audit entries

## SUC-003: Change Computer Disposition
Parent: UC-4.5

- **Actor**: Quartermaster
- **Preconditions**: Computer exists.
- **Main Flow**:
  1. Quartermaster views Computer detail.
  2. Changes disposition (e.g., Active → Needs Repair → In Repair →
     Active, or Active → Scrapped).
  3. System updates disposition and writes audit log.
- **Postconditions**: Disposition is updated. Audit log records the
  transition.
- **Acceptance Criteria**:
  - [x] All disposition states are available
  - [x] Disposition change is recorded in audit log

## SUC-004: Manage Host Names
Parent: UC-4.6

- **Actor**: Quartermaster
- **Preconditions**: Host names exist in the pool (seeded or added).
- **Main Flow**:
  1. Quartermaster views the host name list showing all names, their
     assignment status, and linked Computer (if assigned).
  2. Quartermaster can add new host names to the pool.
  3. When creating or editing a Computer, Quartermaster can assign or
     unassign a host name.
- **Postconditions**: Host name pool is managed. Assignments are tracked.
- **Acceptance Criteria**:
  - [x] Host name list shows available and assigned names
  - [x] New host names can be added
  - [x] Host names can be assigned/unassigned via Computer form

## SUC-005: Assign Computer to Kit or Site
Parent: UC-4.3

- **Actor**: Quartermaster
- **Preconditions**: Computer exists. Target Kit or Site exists.
- **Main Flow**:
  1. Quartermaster edits a Computer.
  2. Selects assignment: a Kit, a Site, or unassigned.
  3. System updates the foreign key and writes audit log.
- **Postconditions**: Computer is assigned. Previous assignment is cleared.
- **Acceptance Criteria**:
  - [x] Computer can be assigned to a Kit
  - [x] Computer can be assigned to a Site (directly)
  - [x] Computer can be unassigned
  - [x] Assignment change is logged
