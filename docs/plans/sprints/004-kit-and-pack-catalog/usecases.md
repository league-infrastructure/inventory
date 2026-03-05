---
status: complete
---

# Sprint 004 Use Cases

## SUC-001: Create a New Kit
Parent: UC-4.1

- **Actor**: Quartermaster
- **Preconditions**: User is authenticated with QUARTERMASTER role. At least one active Site exists.
- **Main Flow**:
  1. Quartermaster opens Kit creation form.
  2. Enters name, description, and selects an assigned Site.
  3. System creates the Kit with a sequential ID and generates a QR code URL (`/k/{id}`).
  4. Kit detail page is shown.
- **Postconditions**: Kit exists in database with ACTIVE status, QR code assigned.
- **Acceptance Criteria**:
  - [ ] Kit is created with name, description, and site assignment
  - [ ] QR code URL is generated and stored on creation
  - [ ] Audit log entry is written for the creation

## SUC-002: Add a Pack to a Kit
Parent: UC-4.2

- **Actor**: Quartermaster
- **Preconditions**: Kit exists in ACTIVE status.
- **Main Flow**:
  1. From Kit detail, quartermaster selects "Add Pack."
  2. Enters pack name and description.
  3. System creates Pack with QR code URL (`/p/{id}`).
  4. Quartermaster can immediately add Items to the Pack.
- **Postconditions**: Pack exists, linked to Kit, QR code assigned.
- **Acceptance Criteria**:
  - [ ] Pack is created under the correct Kit
  - [ ] QR code URL is generated for the Pack
  - [ ] Pack appears in Kit's detail view

## SUC-003: Add Items to a Pack
Parent: UC-4.2

- **Actor**: Quartermaster
- **Preconditions**: Pack exists.
- **Main Flow**:
  1. From Pack detail, quartermaster selects "Add Item."
  2. Enters item name, type (COUNTED or CONSUMABLE), and expected quantity (for COUNTED items).
  3. System creates the Item linked to the Pack.
- **Postconditions**: Item exists in Pack.
- **Acceptance Criteria**:
  - [ ] Item is created with correct type and quantity
  - [ ] COUNTED items require an expected quantity
  - [ ] CONSUMABLE items do not require a quantity

## SUC-004: Edit Kit, Pack, or Item
Parent: UC-4.4

- **Actor**: Quartermaster
- **Preconditions**: Object exists.
- **Main Flow**:
  1. Quartermaster opens the edit form for a Kit, Pack, or Item.
  2. Changes fields and saves.
  3. System records field-level changes in the audit log.
- **Postconditions**: Object is updated, audit log contains diff.
- **Acceptance Criteria**:
  - [ ] All editable fields can be modified
  - [ ] Audit log captures old and new values for each changed field

## SUC-005: Clone a Kit
Parent: UC-4.11

- **Actor**: Quartermaster
- **Preconditions**: Source Kit exists with at least one Pack.
- **Main Flow**:
  1. From Kit detail, quartermaster selects "Clone Kit."
  2. System creates a new Kit with the same name (appended " (Copy)"), Packs, and Items.
  3. New QR codes are generated for the cloned Kit and all its Packs.
  4. Computers are NOT cloned.
  5. Quartermaster edits the new Kit's name and assigned site.
- **Postconditions**: New Kit exists with identical structure but new IDs and QR codes.
- **Acceptance Criteria**:
  - [ ] Cloned Kit has same Pack/Item structure as original
  - [ ] All new objects get fresh IDs and QR codes
  - [ ] Computers are not duplicated
  - [ ] Audit log records the clone operation

## SUC-006: QR Code URL Routing
Parent: UC-4.1, UC-4.2

- **Actor**: Any user (authenticated or not)
- **Preconditions**: QR code has been scanned.
- **Main Flow**:
  1. User scans QR code, browser navigates to `/k/{id}` or `/p/{id}`.
  2. If authenticated: redirected to the Kit or Pack detail page.
  3. If unauthenticated: shown a public landing page with the object name and a login prompt.
- **Postconditions**: User sees appropriate view based on auth status.
- **Acceptance Criteria**:
  - [ ] `/k/{id}` resolves to Kit detail for authenticated users
  - [ ] `/p/{id}` resolves to Pack detail for authenticated users
  - [ ] Unauthenticated users see a public page with login prompt
