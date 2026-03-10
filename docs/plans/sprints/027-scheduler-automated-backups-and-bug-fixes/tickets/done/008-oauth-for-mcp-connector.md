---
id: "008"
title: "OAuth 2.0 Client Credentials for MCP Connector"
status: done
use-cases: []
depends-on: []
---

# OAuth 2.0 Client Credentials for MCP Connector

## Description

Claude's web app custom connector requires OAuth 2.0 to authenticate.
Add a minimal OAuth 2.0 client credentials grant so Claude can obtain
a Bearer token for the existing MCP endpoint.

### OAuth Metadata (`GET /.well-known/oauth-authorization-server`)

Return JSON with `token_endpoint` and supported grant types.

### Token Endpoint (`POST /oauth/token`)

Accept `grant_type=client_credentials` with `client_id` and
`client_secret` (from body or Basic auth header). The `client_id` is
an arbitrary label, and the `client_secret` is an existing API token.
Validate via TokenService. Return `{ access_token, token_type, expires_in }`.

### Wiring

- Mount OAuth routes in `app.ts` before the MCP handler.
- No changes needed to `tokenAuth` middleware — it already accepts
  Bearer tokens.

## Acceptance Criteria

- [x] OAuth metadata endpoint returns token_endpoint URL
- [x] Token endpoint accepts client_credentials grant
- [x] Returns access_token that works with existing MCP endpoint
- [x] Invalid credentials return 401
- [x] Routes mounted in app.ts

## Testing

- **Existing tests to run**: `npm run test:server`
- **Verification command**: `npm run test:server`
