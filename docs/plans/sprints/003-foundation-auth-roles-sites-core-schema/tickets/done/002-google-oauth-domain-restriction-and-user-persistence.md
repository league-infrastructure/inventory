---
id: '002'
title: Google OAuth domain restriction and User persistence
status: done
use-cases: []
depends-on:
- '001'
---

# Google OAuth domain restriction and User persistence

## Description

Modify the existing Google OAuth strategy in `server/src/routes/auth.ts` to:
1. Restrict login to jointheleague.org domain using the `hd` parameter.
2. Validate the domain in the callback (defense in depth — `hd` can be
   spoofed).
3. Upsert user records to the User table on each successful login.
4. Update Passport serialize/deserialize in `app.ts` to store/retrieve the
   User's database ID instead of the raw profile object.
5. Remove or disable GitHub OAuth strategy (not needed for this project).

## Acceptance Criteria

- [ ] Google OAuth strategy includes `hd: 'jointheleague.org'` in options
- [ ] OAuth callback validates email domain is `@jointheleague.org`; rejects others with an error redirect
- [ ] On successful login, user is upserted in the User table (create if new, update displayName/avatar if existing)
- [ ] Passport serializes the User's database ID to the session
- [ ] Passport deserializes by loading the User from the database (with role)
- [ ] `/api/auth/me` returns the user record from the database (id, email, displayName, avatar, role)
- [ ] GitHub OAuth strategy and routes are removed from `auth.ts`
- [ ] GitHub OAuth dependencies removed from `package.json` if no longer needed
- [ ] Logout still works correctly

## Testing

- **Existing tests to run**: Any existing auth tests in `tests/server/`
- **New tests to write**: OAuth callback domain validation (mock profile with non-jointheleague.org email → rejection), user upsert on login, serialize/deserialize round-trip, `/auth/me` response shape
- **Verification command**: `cd server && npm test`
