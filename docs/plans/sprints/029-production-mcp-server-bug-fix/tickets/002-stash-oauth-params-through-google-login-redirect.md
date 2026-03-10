---
id: "002"
title: "Stash OAuth params through Google login redirect"
status: todo
use-cases: []
depends-on: ["001"]
---

# Stash OAuth params through Google login redirect

## Description

When a user hits `/oauth/authorize` without being logged in, we need to:

1. Save the OAuth params (`client_id`, `redirect_uri`, `state`,
   `code_challenge`, `code_challenge_method`) in the Express session
2. Redirect to Google OAuth login
3. After Google OAuth callback completes, detect the stashed OAuth
   params in the session
4. Redirect back to `/oauth/authorize` (which now sees a logged-in
   user and completes the flow)

### Changes needed

- `GET /oauth/authorize` — when no session, stash params in
  `req.session.pendingOAuth` and redirect to `/api/auth/google`
- Google OAuth callback (`/api/auth/google/callback`) — after
  successful login, check `req.session.pendingOAuth`. If present,
  rebuild the `/oauth/authorize` URL and redirect there instead
  of the normal post-login redirect.

## Acceptance Criteria

- [ ] Unauthenticated user hitting /oauth/authorize gets redirected to Google login
- [ ] OAuth params survive the Google OAuth round-trip in session
- [ ] After Google login, user is redirected back to /oauth/authorize
- [ ] Normal Google login (without pending OAuth) still works as before

## Testing

- **Existing tests to run**: `npm run test:server`
- **Verification command**: `npm run test:server`
