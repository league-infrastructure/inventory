---
id: "001"
title: "Add OAuth authorization code flow with PKCE"
status: todo
use-cases: []
depends-on: []
---

# Add OAuth authorization code flow with PKCE

## Description

Claude.ai's MCP connector uses the OAuth 2.0 authorization code flow
(not client_credentials). We need to implement the full flow:

1. **Authorization endpoint** (`GET /oauth/authorize`) — accepts
   `client_id`, `redirect_uri`, `response_type=code`, `state`,
   `code_challenge`, `code_challenge_method`. If user is logged in,
   generates an authorization code and redirects back. If not logged
   in, stashes params in session and redirects to Google OAuth (ticket 002).

2. **Authorization code storage** — short-lived codes (e.g., 10 min)
   mapping to userId, clientId, redirectUri, codeChallenge. Can use
   in-memory Map with TTL cleanup.

3. **Token endpoint update** — add `authorization_code` grant type
   support to `POST /oauth/token`. Validates the code, verifies
   `code_verifier` against stored `code_challenge` (PKCE S256),
   creates an API token for the user, returns it as `access_token`.

4. **Metadata update** — update `/.well-known/oauth-authorization-server`
   to advertise `authorization_endpoint`, `authorization_code` grant,
   `code_challenge_methods_supported: ["S256"]`, and
   `response_types_supported: ["code"]`.

### Key design decisions

- Authorization codes are stored in memory (they're short-lived
  and single-use; no need for DB persistence)
- On code exchange, we create a real API token for the user so
  the access_token works with existing Bearer auth middleware
- PKCE (S256) is required for security

## Acceptance Criteria

- [ ] GET /oauth/authorize redirects logged-in users back with code
- [ ] GET /oauth/authorize redirects unauthenticated users to login (ticket 002)
- [ ] POST /oauth/token accepts authorization_code grant with code_verifier
- [ ] PKCE S256 verification works
- [ ] Authorization codes expire after 10 minutes
- [ ] Authorization codes are single-use
- [ ] Metadata endpoint advertises authorization code flow
- [ ] Existing client_credentials flow still works

## Testing

- **Existing tests to run**: `npm run test:server`
- **Verification command**: `npm run test:server`
