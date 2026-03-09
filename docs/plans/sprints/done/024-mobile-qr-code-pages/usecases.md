---
status: draft
---

# Sprint 024 Use Cases

## SUC-024-001: Scan QR and View Item on Phone

- **Actor**: Instructor, Custodian, or Quartermaster with a phone
- **Preconditions**: A printed QR label on a kit, pack, or computer
- **Main Flow**:
  1. User scans QR code with phone camera.
  2. Phone browser opens `/qr/k/:id` (or `/qr/p/:id`, `/qr/c/:id`).
  3. If not logged in, page shows item name/number and a "Sign in" button.
  4. After sign-in, user is redirected back to the same `/qr/` page.
  5. Page displays: item name, number, photo (if any), current status
     (custodian, site, disposition).
  6. Action buttons are displayed based on item state.
- **Postconditions**: User sees item info and available actions on a
  mobile-friendly page.
- **Acceptance Criteria**:
  - [ ] QR page loads and renders correctly on phone-sized screens
  - [ ] Unauthenticated users see item preview and sign-in button
  - [ ] After login, user returns to the QR page (not home)

## SUC-024-002: One-Tap Check Out to Self

- **Actor**: Authenticated user on phone
- **Preconditions**: Item is not currently checked out to anyone
- **Main Flow**:
  1. User taps "Check Out to Me" button.
  2. System creates a transfer record: custodian = current user.
  3. Confirmation shown with "Checked out to [your name]".
  4. Page refreshes to show updated status.
- **Postconditions**: Item is assigned to the user as custodian.
- **Acceptance Criteria**:
  - [ ] Single tap completes checkout
  - [ ] Transfer record created with audit trail
  - [ ] Status updates immediately on page

## SUC-024-003: One-Tap Check In to Current Site

- **Actor**: Authenticated user on phone with location enabled
- **Preconditions**: Item is currently checked out
- **Main Flow**:
  1. User taps "Check In Here" button.
  2. System requests geolocation from the browser.
  3. System matches coordinates to nearest known site.
  4. If close match found, shows "Check in to [Site Name]?" with confirm.
  5. If no close match, shows site picker dropdown.
  6. User confirms. Transfer clears custodian and sets site.
- **Postconditions**: Item is checked in to site, custodian cleared.
- **Acceptance Criteria**:
  - [ ] Geolocation used to suggest nearest site
  - [ ] Fallback site picker when no close match
  - [ ] Transfer record created

## SUC-024-004: Report an Issue from Mobile

- **Actor**: Authenticated user on phone
- **Preconditions**: User is on a QR page for any item type
- **Main Flow**:
  1. User taps "Report Issue" button.
  2. Text input expands for a brief description.
  3. User types or dictates the issue and taps "Submit".
  4. System creates a note on the item with type "ISSUE".
- **Postconditions**: Issue note attached to the item.
- **Acceptance Criteria**:
  - [ ] Issue note created and visible in desktop detail page
  - [ ] Confirmation shown after submission

## SUC-024-005: Add Photo from Mobile

- **Actor**: Authenticated user on phone
- **Preconditions**: User is on a QR page for any item type
- **Main Flow**:
  1. User taps "Add Photo" button.
  2. Phone opens camera or photo picker.
  3. User takes/selects a photo.
  4. System uploads via `/api/images/upload`.
  5. Photo thumbnail appears on the page.
- **Postconditions**: Photo attached to the item.
- **Acceptance Criteria**:
  - [ ] Camera/picker opens on tap
  - [ ] Upload completes and thumbnail shown
  - [ ] Image visible on desktop detail page
