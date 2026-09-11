---
status: done
sprint: '007'
tickets:
- 007-001
---

# MCP OAuth: deploy the pending session fix and make discovery spec-compliant

## Symptom

Attaching Claude to `https://inventory.jointheleague.org/api/mcp` prompts for
login, runs the Google login, and then lands the user on the inventory
dashboard instead of returning to Claude with an authorization code. The
connector never completes.

## Findings (2026-09-11)

1. **The fix is written but not deployed.** Commit `8117f94` (tag
   `v0.20260715.1`, "preserve pendingOAuth/returnTo across Google login
   session regeneration") adds `keepSessionInfo: true` to both
   `passport.authenticate('google', ...)` calls in
   `server/src/routes/auth.ts`. Production (`swarm2`, service
   `inventory_server`) is still running image
   `ghcr.io/league-infrastructure/inventory-server:0.20260710.2`, deployed
   two months ago. Every tag from `v0.20260715.1` through `v0.20260721.6`
   contains the fix. Running `npm run deploy` ships it (along with all other
   work since July 10, including migrations — review before deploying).

2. **Discovery endpoints are not what current Claude clients expect.**
   Verified against production:
   - `POST /api/mcp` without a token returns `401` with **no
     `WWW-Authenticate` header**. The MCP authorization spec (2025-06-18+)
     requires `WWW-Authenticate: Bearer resource_metadata="<url>"` so the
     client can find the protected-resource metadata.
   - `/.well-known/oauth-protected-resource` (root and path-aware
     `/.well-known/oauth-protected-resource/api/mcp`) and the path-aware
     `/.well-known/oauth-authorization-server/api/mcp` all return **200 with
     the React app's `index.html`** because the SPA catch-all in
     `server/src/app.ts:194-200` swallows every unknown path. A 200 HTML
     body where JSON is expected is worse than a 404.
   - `/.well-known/oauth-authorization-server` at the root works and is
     correct.
   - The authorization-server metadata lists
     `token_endpoint_auth_methods_supported: [client_secret_post,
     client_secret_basic]` but not `none`, and has no
     `registration_endpoint`. Claude Code and claude.ai custom connectors
     need one of: dynamic client registration (RFC 7591), a client ID
     metadata document (`client_id_metadata_document_supported: true` plus
     `none` auth), or a manually supplied client id. The auth-code path in
     `oauth.ts` does not validate `client_id` at all, so any manually
     supplied id works today; that should be documented on the MCP Setup
     page.

3. The token endpoint accepts both form-encoded and JSON bodies and PKCE
   S256 verification is implemented; those parts are fine.

## Requested change

- Add `WWW-Authenticate: Bearer realm="mcp",
  resource_metadata="<PUBLIC_URL>/.well-known/oauth-protected-resource"` to
  every 401 from `server/src/middleware/tokenAuth.ts`.
- Serve RFC 9728 protected-resource metadata at
  `/.well-known/oauth-protected-resource` and
  `/.well-known/oauth-protected-resource/api/mcp` with
  `resource: "<PUBLIC_URL>/api/mcp"` and
  `authorization_servers: ["<PUBLIC_URL>"]`.
- Serve the path-aware `/.well-known/oauth-authorization-server/api/mcp`
  variant too, and make every `/.well-known/*` path that is not handled
  return 404 JSON instead of falling through to the SPA.
- Add `none` to `token_endpoint_auth_methods_supported` and either a
  minimal `registration_endpoint` (accept any registration, return a
  generated `client_id`) or CIMD support, so Claude Code's `/mcp` login and
  the claude.ai custom connector work without a manually entered client id.
- Accept loopback redirect URIs (`http://localhost:<any port>/callback` and
  `http://127.0.0.1:<any port>/callback`) and
  `https://claude.ai/api/mcp/auth_callback`.
- Update the "Claude Web App" and add a "Claude Code via OAuth" section on
  the MCP Setup page with the exact steps (`claude mcp add --transport http
  inventory <url>/api/mcp`, then `/mcp` to authorize).
- Add server tests for the 401 header, both metadata documents, and the
  well-known 404 behaviour.

## Acceptance

- After deploy, the logged-out flow `GET /oauth/authorize?...` → Google →
  callback → `redirect_uri?code=...&state=...` completes end to end from
  Claude Code and from a claude.ai custom connector.
- `curl -i -X POST https://inventory.jointheleague.org/api/mcp` shows the
  `WWW-Authenticate` header; the two `.well-known` documents return JSON.
