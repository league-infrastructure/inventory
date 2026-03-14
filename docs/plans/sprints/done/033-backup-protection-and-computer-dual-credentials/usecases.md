---
status: done
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Sprint 033 Use Cases

## SUC-001: Prevent Deletion of Scheduled Backups
Parent: UC-4.9

- **Actor**: Admin
- **Preconditions**: Backup list displayed with both scheduled and ad-hoc backups
- **Main Flow**:
  1. Admin views the backup list
  2. Scheduled backups (daily-*, weekly-*) do not show a delete button
  3. If admin attempts to delete a scheduled backup via API, request is
     rejected with 400 error
- **Postconditions**: Scheduled backups remain intact
- **Acceptance Criteria**:
  - [ ] API rejects DELETE for filenames starting with daily- or weekly-
  - [ ] UI hides delete button for scheduled backups
  - [ ] Ad-hoc backups can still be deleted normally

## SUC-002: Dual Credentials on Computer Records
Parent: UC-4.3

- **Actor**: Quartermaster
- **Preconditions**: Computer record exists
- **Main Flow**:
  1. Quartermaster opens computer detail page
  2. Sees both Admin and Student credential fields
  3. Can edit either set independently
  4. When printing a compact label, student credentials are shown
- **Postconditions**: Computer stores both credential sets
- **Acceptance Criteria**:
  - [ ] Computer model has studentUsername and studentPassword fields
  - [ ] Detail form shows both admin and student credential pairs
  - [ ] Compact label prints student credentials
  - [ ] Existing computers get studentUsername=student, studentPassword=student
