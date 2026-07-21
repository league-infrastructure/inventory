---
status: done
---

# Fix OAuth connector: pendingOAuth/returnTo lost on Passport login

## Context

The Claude.ai "Inventory" MCP connector shows "Your connection has expired." When
the stakeholder clicks Connect, they're taken to the inventory site, log in, and
land on the inventory dashboard instead of being bounced back to Claude with an
authorization code — so the connector never re-authorizes.

Root cause, confirmed by two independent code investigations:

- `GET /oauth/authorize` ([server/src/routes/oauth.ts:73-84](server/src/routes/oauth.ts#L73-L84)),
  when the user isn't logged in, stashes the OAuth request params on the session
  (`req.session.pendingOAuth = {...}`) and redirects to `/api/auth/google`.
- `server/package.json` pins `"passport": "^0.7.0"`. Passport 0.7's
  `SessionManager.logIn` (called internally by `passport.authenticate('google', ...)`
  on successful login) **always calls `req.session.regenerate()`** as anti-fixation
  protection, replacing the session object/ID entirely. It only carries forward
  data from the pre-login session if the `keepSessionInfo: true` option was passed
  to `passport.authenticate()`.
- Neither `passport.authenticate('google', {...})` call in
  [server/src/routes/auth.ts](server/src/routes/auth.ts) — the initiation at
  line ~117 or the callback at line ~129 — passes `keepSessionInfo`. So
  `pendingOAuth` (and similarly `returnTo`, set at [auth.ts:115](server/src/routes/auth.ts#L115))
  is wiped by the time the callback handler runs.
- The callback then falls through to its default:
  `const returnTo = req.session.returnTo || '/'; res.redirect(returnTo);`
  ([auth.ts:146-148](server/src/routes/auth.ts#L146-L148)) — landing the user on
  the app's home page instead of resuming `/oauth/authorize`, exactly matching the
  reported symptom.

This also silently breaks every other post-login `returnTo` redirect that goes
through the "not yet logged in" path (e.g. QR-code landing/auth flows in
`client/src/pages/kits/QrLanding.tsx` and `client/src/pages/qr/useQrAuth.ts`), not
just the Claude connector — those happen to be less visible because they often
land somewhere plausible-looking too.

Infra was ruled out first: session store is Postgres via `connect-pg-simple` (not
in-memory), `trust proxy` is set correctly, only one server replica runs, and
`req.session.save()` is already correctly awaited before the redirect to Google.
The bug is purely the missing `keepSessionInfo` option.

## Fix

In `server/src/routes/auth.ts`, add `keepSessionInfo: true` to both
`passport.authenticate('google', {...})` option objects:

1. Initiation, ~line 117-120:
   ```ts
   passport.authenticate('google', {
     scope: ['profile', 'email'],
     hd: 'jointheleague.org',
     keepSessionInfo: true,
   } as any)(req, res, next);
   ```
2. Callback, ~line 129:
   ```ts
   passport.authenticate('google', { failureRedirect: '/?error=auth_failed', keepSessionInfo: true })(req, res, next);
   ```

This is a minimal, targeted two-line change — no other files need modification.
`pendingOAuth` and `returnTo` will then survive the session regeneration Passport
performs on login, and the existing logic in `auth.ts:131-149` (redirect back to
`/oauth/authorize` when `pendingOAuth` is present, else `returnTo`) will work as
originally intended.

## Verification

1. Run the server locally (or use the `run` skill) with Google OAuth configured.
2. Simulate the connector flow manually: while logged out, hit
   `GET /oauth/authorize?client_id=test&redirect_uri=http://localhost:1234/callback&response_type=code&state=abc123`
   in a browser, log in via Google, and confirm the browser ends up redirected to
   `http://localhost:1234/callback?code=...&state=abc123` rather than `/`.
3. Check existing auth/session tests (`tests/server/helpers/auth.ts`,
   `tests/e2e/fixtures/auth.ts`) for related coverage; add a regression test if
   there's a suitable integration test harness for the `/oauth/authorize` →
   Google login → callback round-trip.
4. Once deployed, ask the stakeholder to re-run the real "Reconnect" flow from
   Claude's connector settings to confirm it now returns to Claude successfully.
