---
id: '003'
title: Client MCP Setup page rework
status: open
use-cases:
- SUC-002
- SUC-003
- SUC-004
depends-on:
- '002'
github-issue: ''
issue: mcp-setup-show-full-api-token.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Client MCP Setup page rework

## Description

With ticket 002 making the full token available from `GET /api/tokens`,
this ticket reworks `client/src/pages/McpSetup.tsx` to actually show it:
render every non-revoked token in full, drop the `localStorage`
dependency and the `<prefix>...` fallback entirely, list all of the
user's tokens instead of just the newest one (`tokens[0]`), and add a
"Claude Code via OAuth" instructions section alongside the existing
claude.ai connector instructions (ticket 001 makes that OAuth path
actually work).

This ticket completes `mcp-setup-show-full-api-token.md` (ticket 002
did the server half).

## Acceptance Criteria

- [ ] The API Key field and both config snippets (Claude Desktop, Claude
      Code) render the complete token verbatim — no `...`, no `truncate`
      CSS class, no "Token not available — regenerate" state for tokens
      that have a stored value.
- [ ] Tokens with `token = null` (pre-migration) show a "regenerate to
      reveal" note instead of a truncated value or a crash.
- [ ] The page lists every one of the caller's non-revoked tokens (label,
      created date, last used, full token value, copy button, revoke
      button) — not just `tokens[0]`.
- [ ] The config snippets default to the most recently created token
      labeled `mcp` if one exists; otherwise fall back to the newest
      token overall.
- [ ] Revoking a token from the list removes it from the list without
      affecting the display of the others.
- [ ] All `localStorage` reads/writes for `mcp_token_<id>` are removed
      from `McpSetup.tsx`.
- [ ] A new "Claude Code via OAuth" section documents: `claude mcp add
      --transport http inventory <PUBLIC_URL>/api/mcp`, then `/mcp` to
      authorize — no client id needed now that dynamic client
      registration exists (ticket 001). The existing claude.ai custom
      connector section is kept, with a note that no manually entered
      client id/secret is required.
- [ ] `client/src/pages/admin/AdminTokens.tsx` is left unchanged — it may
      keep showing prefixes for other users' tokens (out of scope per
      issue).
- [ ] Manual verification against production/staging: opening MCP Setup
      in a fresh browser with empty `localStorage` shows the complete
      token for an existing key with a non-null `token` value.

## Implementation Plan

**Approach**: Replace the single-token view in `McpSetup.tsx` with a
list view driven by the full `GET /api/tokens` response (now including
`token`, per ticket 002). Remove all localStorage read/write calls.
Compute the "default" token for the config snippets client-side (prefer
label `mcp`, else newest). Add the new OAuth instructions section as
static content (no new API needed — ticket 001 makes the underlying
flow work).

**Files to modify**:
- `client/src/pages/McpSetup.tsx` — token list rendering, snippet
  defaulting logic, localStorage removal, new OAuth section.
- `docs/mcp.md` — if any client-facing instructions duplicated there
  need to match the new page copy (verify during review; likely already
  covered by ticket 001's doc update for the OAuth flow specifically).

**Testing plan**: `npm run test:client` currently has no test files for
this project; this ticket does not introduce a new client test harness
(consistent with sprint.md's Test Strategy). Verify manually against the
acceptance criteria: fresh browser / empty localStorage, multiple tokens
with mixed `mcp`/`oauth` labels, at least one pre-migration
`token = null` token, and a revoke action.

**Documentation updates**: None beyond what ticket 001 already covers in
`docs/mcp.md`; this ticket's changes are UI-only.
