---
status: complete
---

# Sprint 005 Use Cases

## SUC-001: Manage Quartermaster Patterns via Admin Dashboard
Parent: UC-4.7

- **Actor**: System Administrator (fixed-password admin)
- **Preconditions**: Admin is logged into the admin dashboard.
- **Main Flow**:
  1. Admin navigates to the "Permissions" panel in the admin dashboard.
  2. Admin sees a list of current Quartermaster email patterns.
  3. Admin can add a new pattern (exact email or regex) with a checkbox for regex mode.
  4. Admin can delete an existing pattern.
  5. Changes take effect on the next Google OAuth login for affected users.
- **Postconditions**: QuartermasterPattern table is updated. Future logins check updated patterns.
- **Acceptance Criteria**:
  - [ ] Admin dashboard has a "Permissions" nav item
  - [ ] Permissions panel lists all Quartermaster patterns
  - [ ] Admin can add a pattern (exact or regex)
  - [ ] Admin can delete a pattern
  - [ ] Invalid regex is rejected with an error message
  - [ ] Duplicate patterns are rejected
