---
id: '004'
title: Token management REST routes
status: done
use-cases:
- SUC-001
- SUC-002
- SUC-006
depends-on:
- '002'
---

# Token management REST routes

## Description

Create `server/src/routes/tokens.ts` with REST endpoints for token
management. All endpoints require session-based authentication (not
token auth) to prevent MCP clients from managing tokens.

### User routes (session auth required)

- `POST /api/tokens` — create a new token. Body: `{ label }`. Returns
  the token object including the plaintext token (shown only once).
- `GET /api/tokens` — list the current user's non-revoked tokens.
- `DELETE /api/tokens/:id` — revoke a token owned by the current user.

### Admin routes (session auth + Quartermaster role required)

- `GET /api/admin/tokens` — list all tokens across all users, with
  owning user's name and email.
- `DELETE /api/admin/tokens/:id` — revoke any token (admin override).

### Security

These routes MUST only be accessible via session auth (`requireAuth`
middleware). They must NOT be accessible via Bearer token auth.

## Acceptance Criteria

- [ ] `POST /api/tokens` creates token and returns plaintext once
- [ ] `GET /api/tokens` lists current user's tokens (no plaintext)
- [ ] `DELETE /api/tokens/:id` revokes user's own token
- [ ] `GET /api/admin/tokens` lists all tokens with user info
- [ ] `DELETE /api/admin/tokens/:id` revokes any token
- [ ] Admin routes require Quartermaster role
- [ ] All routes require session auth (not token auth)
- [ ] Routes registered in `app.ts`

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: API tests for all five endpoints — create,
  list, revoke, admin list, admin revoke. Permission tests verifying
  Instructor cannot access admin routes.
- **Verification command**: `npm run test:server`
