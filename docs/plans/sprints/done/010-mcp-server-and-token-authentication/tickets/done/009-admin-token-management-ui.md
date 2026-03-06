---
id: 009
title: Admin token management UI
status: done
use-cases:
- SUC-006
depends-on:
- '004'
---

# Admin token management UI

## Description

Add a token management section to the existing admin dashboard that
allows Quartermasters to view and revoke all API tokens across all users.

### Token list table

- Fetches data from `GET /api/admin/tokens`.
- Columns: token prefix, user name, user email, role, created date,
  last used date, status (active/revoked/expired).
- Sortable by columns (at minimum: user name, created date, last used).

### Actions

- **Revoke button**: per-row action to revoke any active token. Shows
  confirmation dialog: "This will disconnect the user's MCP client."
  Calls `DELETE /api/admin/tokens/:id`.

### Filtering

- Filter by status: active, revoked, all.
- Filter or search by user name.

### Access

- Only visible to users with Quartermaster role.

## Acceptance Criteria

- [ ] Token list table shows all tokens with user info
- [ ] Table displays prefix, user, role, dates, and status
- [ ] Revoke button with confirmation dialog
- [ ] Status filter (active/revoked/all)
- [ ] Only accessible to Quartermaster-role users
- [ ] Revoked tokens update in the list without page reload

## Testing

- **Existing tests to run**: `npm run test:client`
- **New tests to write**: Component tests — renders token list, revoke
  button shows confirmation, filters by status
- **Verification command**: `npm run test:client`
