---
id: '002'
title: TokenService class
status: done
use-cases:
- SUC-001
- SUC-002
depends-on:
- '001'
---

# TokenService class

## Description

Implement `server/src/services/token.service.ts` — a service class that
manages the lifecycle of personal API tokens. Follows the existing service
layer pattern (receives `PrismaClient` via constructor).

### Methods

- `create(userId, label)` — generates a 32-byte random hex token, stores
  the SHA-256 hash, returns `{ id, label, prefix, token }` where `token`
  is the plaintext (returned only on create).
- `list(userId?)` — if `userId` provided, returns that user's non-revoked
  tokens (id, label, prefix, createdAt, lastUsedAt). If omitted, returns
  all tokens across all users with user info (for admin use).
- `revoke(id, userId?)` — sets `revokedAt`. If `userId` provided, verifies
  ownership. If omitted, allows admin revocation.
- `revokeAllForUser(userId)` — revokes all active tokens for a user.
  Called when a user's role changes.
- `validate(rawToken)` — hashes the token, looks up by hash, checks not
  revoked and not expired, updates `lastUsedAt`, returns
  `{ userId, role }` or throws.

### Integration with ServiceRegistry

Add `TokenService` to the `ServiceRegistry` so it's available alongside
other services.

## Acceptance Criteria

- [ ] `TokenService` class created with all five methods
- [ ] Token generation uses `crypto.randomBytes(32).toString('hex')`
- [ ] Token storage uses SHA-256 hash — plaintext never persisted
- [ ] `prefix` stores first 8 characters of the plaintext token
- [ ] `validate` rejects revoked tokens
- [ ] `validate` rejects expired tokens (when `expiresAt` is past)
- [ ] `validate` updates `lastUsedAt` on successful validation
- [ ] `revokeAllForUser` revokes all active tokens for a user
- [ ] `TokenService` registered in `ServiceRegistry`
- [ ] TypeScript compiles successfully

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: Unit tests for TokenService — create, validate,
  revoke, validate-after-revoke, expired token rejection, list by user,
  list all (admin), revokeAllForUser
- **Verification command**: `npm run test:server`
