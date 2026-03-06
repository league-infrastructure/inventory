---
id: '003'
title: Token authentication middleware
status: done
use-cases:
- SUC-003
depends-on:
- '002'
---

# Token authentication middleware

## Description

Create `server/src/middleware/tokenAuth.ts` — middleware that authenticates
requests using Bearer tokens from the `Authorization` header.

### Behavior

1. Extract `Authorization: Bearer <token>` header.
2. Call `TokenService.validate(token)`.
3. On success, load the full user record from the database and set
   `req.user` with the user object (matching the shape set by Passport
   session auth).
4. On failure (missing header, invalid token, revoked, expired), return
   401 with an appropriate error message.

### Scope

This middleware is used only on MCP routes. Session-based auth continues
unchanged for all REST API routes.

## Acceptance Criteria

- [ ] Middleware extracts Bearer token from Authorization header
- [ ] Valid token sets `req.user` with user record and role
- [ ] Missing Authorization header returns 401
- [ ] Invalid token returns 401
- [ ] Revoked token returns 401
- [ ] Expired token returns 401
- [ ] Non-Bearer auth scheme returns 401

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: Middleware unit tests with mocked TokenService —
  valid token, missing header, invalid token, revoked token
- **Verification command**: `npm run test:server`
