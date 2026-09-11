---
status: pending
---

# MCP Setup page: always show the full API token, never a truncated prefix

## Problem

The MCP Setup page (`client/src/pages/McpSetup.tsx`) renders the API key and
the copy-paste config snippets with `<prefix>...` instead of the real token
whenever the full token is not in the current browser's `localStorage`. A
config snippet with a truncated bearer token is useless. The stakeholder has
been explicit: show the full token, always, no ellipsis.

Why it happens today:

- `TokenService.create` stores only a SHA-256 hash plus an 8-char prefix
  (`server/src/services/token.service.ts:35-49`). The plaintext exists only
  in the create response and is stashed in `localStorage` under
  `mcp_token_<id>` by the client. Any other browser, a cleared localStorage,
  or a token created before that feature shipped leaves the page with no way
  to display it.
- `McpSetup` shows `tokens[0]` — the *newest* token for the user
  (`McpSetup.tsx:50-54`). Every successful OAuth token exchange creates a new
  token labelled `oauth` (`server/src/routes/oauth.ts:195`), so after a
  connector authorization the page silently switches to displaying an
  OAuth-issued token that was never in localStorage, and the "mcp" token the
  user generated is no longer shown at all.

## Requested change

1. Persist the raw token server-side so it can be displayed on demand. Add a
   `token` (plaintext) column to `ApiToken` with a migration; keep `tokenHash`
   for lookups so `validate()` is unchanged. Return the raw token from
   `GET /api/tokens` for the caller's own, non-revoked tokens (session auth
   only — this route is already blocked for token-authenticated requests).
   The stakeholder accepts the plaintext-at-rest trade-off for this internal
   tool; update the "Token storage" note in `docs/mcp.md` accordingly.
2. On the MCP Setup page, render the full token in the API Key field and in
   both config snippets. Remove the `prefix...` fallback, the `truncate` CSS
   class on the key field, and the "Token not available — regenerate" state.
   Drop the localStorage dependency.
3. Show the user's tokens as a list (label, created, last used, full value,
   copy button, revoke) rather than only `tokens[0]`, so OAuth-issued tokens
   don't hide the hand-generated one. Default the config snippets to the
   most recent token labelled `mcp` if one exists.
4. Admin token page (`client/src/pages/admin/AdminTokens.tsx`) may keep
   showing the prefix for other users' tokens; that is not in scope.

## Acceptance

- Opening MCP Setup in a fresh browser shows the complete token for an
  existing key and the config snippets contain it verbatim.
- No `...` appears anywhere in the token or snippets.
- Existing tokens created before the migration have `token = NULL` and are
  shown with a "regenerate to reveal" note; newly created tokens show fully.
- Server and client test suites pass.
