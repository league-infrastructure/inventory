---
status: approved
---

# Sprint 007 Use Cases

## SUC-001: Check Out a Kit
Parent: UC-1.1

- **Actor**: Instructor or Quartermaster
- **Preconditions**: Kit exists, is ACTIVE, is not currently checked out
- **Main Flow**:
  1. User navigates to kit detail page (or scans QR code)
  2. System shows "Check Out" button
  3. User clicks "Check Out"
  4. System requests GPS location (browser Geolocation API)
  5. System suggests nearest site as destination (or user selects manually)
  6. User confirms checkout
  7. System creates checkout record with kit, user, destination site, timestamp
  8. System shows confirmation
- **Postconditions**: Checkout record exists, kit shows as checked out
- **Acceptance Criteria**:
  - [x] Checkout endpoint creates record with all required fields
  - [x] GPS-based site suggestion works (nearest by coordinates)
  - [x] Manual site selection available as fallback
  - [x] Cannot check out an already-checked-out kit (409 Conflict)
  - [x] Checkout recorded in audit log

## SUC-002: Check In a Kit
Parent: UC-1.2

- **Actor**: Instructor or Quartermaster
- **Preconditions**: Kit is currently checked out
- **Main Flow**:
  1. User navigates to kit detail page (or scans QR code)
  2. System detects kit is checked out, shows "Check In" button
  3. User clicks "Check In"
  4. System requests GPS location
  5. System suggests nearest site as return location
  6. User confirms check-in
  7. System updates checkout record with return site and timestamp
  8. System shows confirmation
- **Postconditions**: Checkout record closed, kit available for new checkout
- **Acceptance Criteria**:
  - [x] Check-in endpoint closes the open checkout record
  - [x] Return site and timestamp recorded
  - [x] Kit can be checked out again after check-in
  - [x] Check-in recorded in audit log

## SUC-003: View Checked-Out Kits
Parent: UC-1.3

- **Actor**: Instructor or Quartermaster
- **Preconditions**: User is authenticated
- **Main Flow**:
  1. User navigates to "Checked Out" page (sidebar link)
  2. System shows list of currently checked-out kits
  3. Each row shows: kit name, checked-out-by user, destination site, checkout time
  4. User can click a row to go to the kit detail page
- **Postconditions**: None (read-only)
- **Acceptance Criteria**:
  - [x] List shows all open checkouts
  - [x] Shows who checked out each kit and where
  - [x] Clicking a row navigates to kit detail
