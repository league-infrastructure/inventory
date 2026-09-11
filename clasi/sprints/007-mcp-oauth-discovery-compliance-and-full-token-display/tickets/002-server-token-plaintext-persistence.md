---
id: '002'
title: Server token plaintext persistence
status: open
use-cases:
- SUC-003
- SUC-004
depends-on: []
github-issue: ''
issue: mcp-setup-show-full-api-token.md
completes_issue: false
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Server token plaintext persistence

## Description

`TokenService` currently stores only a SHA-256 hash and an 8-character
prefix, so the plaintext token exists only in the create response and
whatever the client happens to cache in `localStorage`. That's why the
MCP Setup page falls back to `<prefix>...` whenever the full token isn't
in the current browser's storage — including every time after an OAuth
token exchange mints a new token. This ticket adds server-side plaintext
persistence so `GET /api/tokens` can return the full value to its owner.
Ticket 003 (client rework) depends on this one.

`completes_issue: false` — this ticket only does the server half of
`mcp-setup-show-full-api-token.md`; ticket 003 finishes it and archives
the issue.

See `clasi/issues/mcp-setup-show-full-api-token.md` for the full
diagnosis and sprint.md's Design Rationale for why plaintext-at-rest was
chosen over encryption (stakeholder-approved trade-off for this internal
tool).

## Acceptance Criteria

- [ ] A Prisma migration adds `token String?` (nullable) to the
      `ApiToken` model in `server/prisma/schema.prisma`. Purely additive
      — no backfill, existing rows get `token = NULL`.
- [ ] `TokenService.create()` writes the plaintext token to the new
      `token` column in addition to the existing `tokenHash` and
      `prefix`. `TokenService.validate()` is unchanged (still looks up
      by hash only).
- [ ] `GET /api/tokens` (`server/src/routes/tokens.ts`) includes the
      `token` field in its response for the caller's own, non-revoked
      tokens. This route is already session-auth-only (blocked for
      token-authenticated requests) — do not change that access control,
      only the response shape.
- [ ] Revoked tokens do not expose `token` in the `GET /api/tokens`
      response (either omit the field or return `null` for revoked
      rows — pick one and document it in the response, since ticket 003
      needs to know which).
- [ ] `docs/mcp.md`'s token-storage security note is updated to describe
      plaintext-at-rest and the accepted trade-off (currently says
      hash-only storage, which will no longer be accurate).
- [ ] Existing and new tests for `token.service.ts` and the `tokens`
      route cover: `create()` populates `token`; `GET /api/tokens`
      returns `token` for the caller's own tokens; a token created
      before the migration (`token = NULL`) round-trips as `null`, not
      an error.
- [ ] `npm run test:server` passes for suites touched by this change
      (excluding the six pre-existing unrelated failures noted in
      ticket 001 / tracked in
      `server-test-suite-preexisting-failures-and-stale-test-db-config.md`).

## Implementation Plan

**Approach**: Additive Prisma migration, then thread the plaintext value
through `TokenService.create()` and the `GET /api/tokens` handler. No
change to the hash-based `validate()` path — this is purely additive
read access for the owning user.

**Files to modify**:
- `server/prisma/schema.prisma` — add `token String?` to `ApiToken`
  (server/prisma/schema.prisma:379 area).
- `server/prisma/migrations/` — new migration directory (generated via
  the project's standard Prisma migration workflow).
- `server/src/services/token.service.ts` — `create()` writes `token`
  alongside `tokenHash`/`prefix`; add/adjust the return/list shape used
  by `tokens.ts`.
- `server/src/routes/tokens.ts` — `GET /api/tokens` includes `token` for
  the caller's own, non-revoked tokens.
- `docs/mcp.md` — update the token-storage security note.

**Testing plan**: Extend the existing `token.service` and `tokens` route
test files (or add them if they don't already isolate this behavior)
with cases for: token populated on create, returned on list for the
owner, null for pre-migration rows, and excluded/nulled for revoked
tokens. Run against the dev Postgres instance per the project's existing
`npm run test:server` setup.

**Documentation updates**: `docs/mcp.md` security section — replace the
hash-only description with the plaintext-at-rest note and the
stakeholder-accepted trade-off rationale (see sprint.md Design
Rationale).
