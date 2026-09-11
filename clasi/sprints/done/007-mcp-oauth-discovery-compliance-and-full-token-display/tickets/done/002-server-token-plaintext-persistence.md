---
id: '002'
title: Server token plaintext persistence
status: done
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
prefix, so the full token exists only in the create response and
whatever the client happens to cache in `localStorage`. That's why the
MCP Setup page falls back to `<prefix>...` whenever the full token isn't
in the current browser's storage — including every time after an OAuth
token exchange mints a new token. This ticket adds server-side token
persistence, **encrypted at rest, recoverable by owner**, so `GET
/api/tokens` can return the full value to its owner.
Ticket 003 (client rework) depends on this one.

`completes_issue: false` — this ticket only does the server half of
`mcp-setup-show-full-api-token.md`; ticket 003 finishes it and archives
the issue.

See `clasi/issues/mcp-setup-show-full-api-token.md` for the full
diagnosis. **Design refinement (superseding sprint.md's original
Design Rationale, which proposed plaintext-at-rest):** the token is
stored encrypted at rest (AES-256-GCM via a new `tokenCrypto.ts`
module, key derived from `TOKEN_ENCRYPTION_KEY` or, failing that,
`sha256(SESSION_SECRET)`) rather than in plaintext. This meets the same
acceptance criteria — the owner can see the full token again on the MCP
Setup page — without a raw bearer token sitting in the database or its
backups.

## Acceptance Criteria

- [x] A Prisma migration adds `tokenEnc String?` (nullable) to the
      `ApiToken` model in `server/prisma/schema.prisma`. Purely additive
      — no backfill, existing rows get `tokenEnc = NULL`.
- [x] New module `server/src/services/tokenCrypto.ts` provides
      `encryptToken(raw)` / `decryptToken(blob)` using AES-256-GCM, a
      random 12-byte IV per token, and blob format
      `v1:<iv b64>:<tag b64>:<ciphertext b64>`.
- [x] `TokenService.create()` writes the encrypted token to the new
      `tokenEnc` column in addition to the existing `tokenHash` and
      `prefix`. `TokenService.validate()` is unchanged (still looks up
      by hash only).
- [x] `GET /api/tokens` (`server/src/routes/tokens.ts`) includes the
      decrypted `token` field in its response for the caller's own,
      non-revoked tokens. This route is already session-auth-only
      (blocked for token-authenticated requests) — do not change that
      access control, only the response shape.
- [x] Revoked tokens, pre-migration rows (`tokenEnc = NULL`), and rows
      that fail to decrypt do not expose `token` in the `GET
      /api/tokens` response — `token` is `null` for all of these,
      documented on `TokenListItem.token` since ticket 003 relies on
      this convention.
- [x] `GET /api/admin/tokens` never exposes decrypted token values
      (`list()` called with `{ includeToken: false }`).
- [x] `docs/mcp.md`'s token-storage security note is updated to
      describe encrypted-at-rest storage (recoverable by owner) instead
      of hash-only storage.
- [x] Existing and new tests for `token.service.ts` and the `tokens`
      route cover: `create()` populates `tokenEnc`; `GET /api/tokens`
      returns the decrypted `token` for the caller's own tokens; a
      token created before this change (`tokenEnc = NULL`) round-trips
      as `token: null`, not an error; revoked tokens are not listed;
      the admin list never includes a non-null `token`.
- [x] `npm run test:server` passes for suites touched by this change
      (excluding the six pre-existing unrelated failures noted in
      ticket 001 / tracked in
      `server-test-suite-preexisting-failures-and-stale-test-db-config.md`).

## Implementation Plan

**Approach**: Additive Prisma migration, a small AES-256-GCM
encrypt/decrypt module, then thread the encrypted value through
`TokenService.create()` and decrypt it in `list()` only for the owner
path (`GET /api/tokens`), never for the admin path.

**Files modified**:
- `server/prisma/schema.prisma` — added `tokenEnc String?` to
  `ApiToken`.
- `server/prisma/migrations/20260911213612_api_token_encrypted/` — new
  migration.
- `server/src/services/tokenCrypto.ts` — new: `encryptToken`/
  `decryptToken`.
- `server/src/services/token.service.ts` — `create()` writes
  `tokenEnc`; `list()` takes `{ includeToken }` and decrypts only when
  requested, for non-revoked rows with a `tokenEnc` value, swallowing
  decrypt failures as `null`.
- `server/src/routes/tokens.ts` — `GET /api/tokens` passes
  `{ includeToken: true }`; `GET /api/admin/tokens` passes
  `{ includeToken: false }`.
- `docs/mcp.md` — updated the token-storage security note.
- `secrets/dev.env.example` — documented `TOKEN_ENCRYPTION_KEY` as
  optional next to `SESSION_SECRET`.

**Testing plan**: Extended `tests/server/services/token.service.test.ts`
with encrypt/decrypt round-trip and tamper-failure coverage plus a
`tokenEnc = null` list case; added `tests/server/tokens.test.ts` (route
tests via supertest) covering full-token exposure on `GET /api/tokens`
for the owner, `null` for revoked tokens, and no token exposure on
`GET /api/admin/tokens`. Run via `npm run test:server` against the dev
Postgres instance.

**Documentation updates**: `docs/mcp.md` security section — replaced
the hash-only description with the encrypted-at-rest note.
