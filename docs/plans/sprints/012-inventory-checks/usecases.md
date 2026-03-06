---
status: approved
---

# Sprint 012 Use Cases

## SUC-012-001: Kit Inventory Check
Parent: UC-2.1

- **Actor**: Instructor or Quartermaster
- **Preconditions**: Kit exists with packs, items, and/or computers
- **Main Flow**:
  1. User navigates to or scans QR for a kit
  2. System generates a checklist of all packs (with their items) and computers in the kit
  3. For COUNTED items, user confirms or enters actual quantity
  4. For CONSUMABLE items, user toggles present/absent
  5. For computers, user confirms present/absent
  6. User submits the inventory check with optional notes
  7. System records the check with timestamp and user
  8. System flags any discrepancies (actual != expected)
- **Postconditions**: InventoryCheck record created with lines; discrepancies flagged
- **Acceptance Criteria**:
  - [ ] Kit check generates lines for all items and computers
  - [ ] Discrepancies are flagged when actual != expected
  - [ ] Check is recorded with user and timestamp
  - [ ] Audit log entry created

## SUC-012-002: Pack Inventory Check
Parent: UC-2.2

- **Actor**: Instructor or Quartermaster
- **Preconditions**: Pack exists with items
- **Main Flow**:
  1. User navigates to or scans QR for a pack
  2. System generates a checklist of all items in the pack
  3. User confirms or adjusts quantities/presence
  4. User submits the check
  5. System records the check and flags discrepancies
- **Postconditions**: InventoryCheck record created with item lines
- **Acceptance Criteria**:
  - [ ] Pack check generates lines for all items
  - [ ] Discrepancies flagged correctly
  - [ ] Check recorded with user and timestamp

## SUC-012-003: Computer Verification
Parent: UC-2.3

- **Actor**: Instructor or Quartermaster
- **Preconditions**: Computer exists in system
- **Main Flow**:
  1. User scans QR or navigates to computer
  2. User confirms computer is present at expected location
  3. System updates the computer's lastInventoried date
- **Postconditions**: Computer lastInventoried field updated
- **Acceptance Criteria**:
  - [ ] Computer lastInventoried date updated on verification
  - [ ] Audit log entry created

## SUC-012-004: Inventory Check History
Parent: UC-2.1

- **Actor**: Quartermaster
- **Preconditions**: Inventory checks have been performed
- **Main Flow**:
  1. User views a kit or pack detail page
  2. System shows history of past inventory checks
  3. Discrepancies are highlighted
- **Postconditions**: None (read-only)
- **Acceptance Criteria**:
  - [ ] Check history visible on kit/pack detail pages
  - [ ] Discrepancies highlighted in history view
