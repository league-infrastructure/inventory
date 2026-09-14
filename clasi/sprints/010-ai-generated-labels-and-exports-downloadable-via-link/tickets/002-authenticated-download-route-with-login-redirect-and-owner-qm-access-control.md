---
id: '002'
title: Authenticated download route with login-redirect and owner/QM access control
status: done
use-cases:
- SUC-004
- SUC-005
depends-on:
- '001'
github-issue: ''
issue: ai-generated-labels-and-exports-downloadable-via-link.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Authenticated download route with login-redirect and owner/QM access control

## Description

Add `GET /api/downloads/:token`, the only way a browser actually
receives a generated file. `requireAuth`'s existing behavior (JSON 401
for a logged-out request) is the wrong shape here — a browser
following a link needs a redirect to Google login, then to land back
on the same download URL. Reuse the *existing* generic mechanism
already in `server/src/routes/auth.ts` (`GET
/api/auth/google?returnTo=<relative-path>`, which validates the path is
same-origin-relative, stashes it in session, and redirects there after
successful login) — do not build a second login-and-return mechanism
alongside `oauth.ts`'s `pendingOAuth` flow, which is for the separate
MCP OAuth-client registration case.

All "is this token valid, does this user own it" logic already lives
in `GeneratedFileService.resolveForDownload` (ticket 001) — this route
is a thin HTTP translation layer only, per sprint.md's Design
Rationale.

## Acceptance Criteria

- [x] `server/src/routes/downloads.ts` exports a router mounted at
      `/api/downloads/:token` in `app.ts` (alongside the other `/api`
      mounts).
- [x] Logged-out request: redirects (302) to
      `/api/auth/google?returnTo=/api/downloads/<token>` — not a JSON
      401. After a successful Google login, the browser lands back on
      the same download URL (exercised as an integration test, not
      just unit-tested in isolation).
- [x] Logged-in request, valid token, requesting user is the owner or
      has QM access (`hasQMAccess`): responds 200 with the file bytes,
      `Content-Type` set to the stored `mimeType`, and
      `Content-Disposition: attachment; filename="<stored filename>"`.
- [x] Logged-in request, valid token, requesting user is neither owner
      nor QM: 403, no bytes returned.
- [x] Logged-in request, unknown or expired token: 404 — expired and
      never-existed tokens are indistinguishable to the caller (no
      existence/timing leak, per ticket 001's
      `resolveForDownload` contract).
- [x] A loanee-role user (`STUDENT`/`PARTNER`, per
      `LOANEE_ROLES`/`requireAuth`'s existing restriction) is denied
      the same way `requireAuth`-gated routes deny them today — confirm
      this is either inherited for free (if using `requireAuth`-style
      role logic ahead of the redirect check) or explicitly checked; do
      not silently allow loanee accounts through a route other
      `requireAuth` routes block.

## Testing

- **Existing tests to run**: `server/src/routes/auth.ts`'s existing
  tests (the `returnTo` mechanism must not regress) and any existing
  `requireAuth` middleware tests.
- **New tests to write**: an integration test for the full
  logged-out → redirect → Google login (test-auth bypass, per
  `server/src/routes/testAuth.ts`, in non-production) → redirected back
  → 200-with-bytes round trip; unit/integration tests for each
  acceptance-criteria branch above (owner, QM, forbidden third party,
  expired, unknown token).
- **Verification command**: `cd server && npx jest --config
  ../tests/server/jest.config.js src/routes/downloads`.
