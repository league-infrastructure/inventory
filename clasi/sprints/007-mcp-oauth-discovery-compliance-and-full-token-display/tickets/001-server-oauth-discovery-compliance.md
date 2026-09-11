---
id: '001'
title: Server OAuth discovery compliance
status: done
use-cases:
- SUC-001
- SUC-002
depends-on: []
github-issue: ''
issue: mcp-oauth-discovery-compliance-and-deploy.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Server OAuth discovery compliance

## Description

Production's OAuth discovery surface doesn't match what current Claude
clients (Claude Code, claude.ai custom connectors) expect: 401s from
`/api/mcp` carry no `WWW-Authenticate` header, the RFC 9728
protected-resource metadata and the path-aware RFC 8414
authorization-server metadata both 404 into the SPA catch-all instead of
returning JSON, there's no dynamic client registration or `none` auth
method, and `/oauth/authorize` doesn't restrict `redirect_uri`. This
ticket makes discovery and registration spec-compliant so a connector can
attach without any manually configured client id.

See `clasi/issues/mcp-oauth-discovery-compliance-and-deploy.md` for the
full verified diagnosis (production endpoints, file locations, exact
line numbers) and sprint.md's Architecture section for the module
breakdown (new well-known router vs. extended `oauth.ts`) and design
rationale.

## Acceptance Criteria

- [x] `tokenAuth.ts` adds `WWW-Authenticate: Bearer realm="mcp",
      resource_metadata="<PUBLIC_URL>/.well-known/oauth-protected-resource"`
      to every 401 response it returns (all three 401 branches: missing
      header, malformed header, invalid/expired token).
- [x] A new well-known router serves `/.well-known/oauth-protected-resource`
      and `/.well-known/oauth-protected-resource/api/mcp` as JSON:
      `{ resource: "<PUBLIC_URL>/api/mcp", authorization_servers:
      ["<PUBLIC_URL>"], scopes_supported: [], bearer_methods_supported:
      ["header"] }`.
- [x] The same router serves `/.well-known/oauth-authorization-server/api/mcp`
      as JSON, matching the existing root document but with
      `"none"` added to `token_endpoint_auth_methods_supported`, plus
      `registration_endpoint`, `client_id_metadata_document_supported:
      true`, and `scopes_supported: []`.
- [x] The existing root `/.well-known/oauth-authorization-server` document
      is updated with the same additions (`none`, `registration_endpoint`,
      `client_id_metadata_document_supported`, `scopes_supported`).
- [x] Any other unhandled path under `/.well-known/` returns 404 JSON
      (e.g. `{ error: "not_found" }`), never falls through to the SPA
      `index.html`. This router (and its 404 guard) is mounted in
      `app.ts` *before* the production `app.get('*')` SPA catch-all.
- [x] `POST /oauth/register` accepts any JSON body and returns 201 with a
      generated opaque `client_id`, echoing back `redirect_uris`,
      `client_name`, and `grant_types` from the request, plus
      `token_endpoint_auth_method: "none"`. No persistence required —
      stateless, matching that `client_id` is not validated elsewhere
      today (see Design Rationale in sprint.md for why this is
      intentional, not a shortcut).
- [x] `/oauth/authorize` validates `redirect_uri` against an allow-list:
      `https://claude.ai/api/mcp/auth_callback`,
      `https://claude.com/api/mcp/auth_callback`, and any
      `http://localhost:<port>/...` or `http://127.0.0.1:<port>/...`
      loopback URL. Any other `redirect_uri` gets 400
      `{ error: "invalid_request" }` instead of proceeding.
- [x] New tests in `tests/server/oauth-discovery.test.ts` cover: the
      `WWW-Authenticate` header on all three 401 cases, both
      protected-resource metadata documents, both authorization-server
      metadata documents (root and path-aware), the `/.well-known/*` 404
      guard, `POST /oauth/register`, and the `redirect_uri` allow-list
      (both accept and reject cases).
- [x] `npm run test:server` passes for this new suite and for any
      existing suite touched by this change (excluding the six
      pre-existing unrelated failures — app, auth, github, pike13,
      integrations, issue.service — tracked in
      `server-test-suite-preexisting-failures-and-stale-test-db-config.md`;
      do not attempt to fix those).

## Implementation Plan

**Approach**: Add a new `server/src/routes/wellKnown.ts` router owning
the `/.well-known/` namespace (metadata documents + 404 guard), mount it
in `app.ts` ahead of the SPA catch-all. Extend `oauth.ts` with
`/oauth/register` and the `redirect_uri` allow-list check inside the
existing `/oauth/authorize` handler. Extend `tokenAuth.ts`'s three 401
branches with the new header. Use `process.env.PUBLIC_URL` for the base
URL, consistent with existing metadata construction in `oauth.ts`.

**Files to create**:
- `server/src/routes/wellKnown.ts` — protected-resource and
  authorization-server metadata handlers (root + path-aware), plus the
  `/.well-known/*` 404 guard.
- `tests/server/oauth-discovery.test.ts`

**Files to modify**:
- `server/src/middleware/tokenAuth.ts` — add `WWW-Authenticate` to all
  401 responses.
- `server/src/routes/oauth.ts` — add `/oauth/register`; add
  `redirect_uri` allow-list validation to `/oauth/authorize`; add `none`
  / `registration_endpoint` / `client_id_metadata_document_supported` /
  `scopes_supported` to the existing root AS metadata response.
- `server/src/app.ts` — mount `wellKnownRouter` before the production
  `app.get('*')` catch-all; add a comment noting the ordering
  requirement (see sprint.md Migration Concerns).
- `docs/mcp.md` — document the OAuth discovery/DCR flow and the
  "Claude Code via OAuth" connection path (`claude mcp add --transport
  http inventory <url>/api/mcp` then `/mcp`).

**Testing plan**: New Jest suite exercises each endpoint directly via
supertest against the Express app (following this project's existing
test pattern for other route suites). Verify against a running dev
server with `curl -i` for the header and JSON shape as a manual
sanity check before running the automated suite.

**Documentation updates**: `docs/mcp.md` — add discovery/DCR explanation
and the Claude Code OAuth section referenced in sprint.md's Solution.
