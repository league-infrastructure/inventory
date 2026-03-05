---
id: 009
title: MCP Server and Token Authentication
status: planning
branch: sprint/009-mcp-server-and-token-authentication
use-cases: []
---

# Sprint 009: MCP Server and Token Authentication

## Goals

Expose the inventory application's operations as an MCP (Model Context
Protocol) server that external AI models can connect to. Implement
personal API token authentication so users can grant AI models access
at their own permission level. Add AI-specific audit logging.

## Problem

Users want to use external AI models (Claude, OpenAI, etc.) to manage
inventory data — creating packs, updating computers, performing
check-ins — via voice dictation or natural language. There is currently
no programmatic interface that an AI model can call, and no way to
authenticate an external model as acting on behalf of a specific user.

## Solution

- Implement an MCP server that runs as part of the Express application,
  exposing inventory operations (CRUD on kits, packs, items, computers,
  host names, sites; check-in/check-out) as MCP tools.
- Use Streamable HTTP transport so external clients can connect via a
  URL.
- Add a personal API token system: users create tokens from the UI,
  tokens carry the user's role, and are used by external models to
  authenticate to the MCP server.
- Extend the audit log to flag AI-initiated changes and store the full
  prompt/text that triggered each change.

## Success Criteria

- An external MCP client can connect to the server URL with a valid
  token and list available tools.
- The MCP client can call tools (e.g., create a pack, update a
  computer) and changes are persisted.
- Tool calls respect the token owner's permissions (Instructor vs
  Quartermaster).
- Users can create, view, and revoke tokens from a UI page.
- AI-initiated changes appear in the audit log with the source prompt
  recorded.
- Invalid or revoked tokens are rejected with appropriate errors.

## Scope

### In Scope

- MCP server implementation (Streamable HTTP transport)
- MCP tools wrapping existing API operations
- Personal API token model (create, list, revoke)
- Token management UI page (under admin or user settings)
- Token-based authentication middleware for MCP endpoints
- AI audit log extension (flag + prompt storage)
- Token-authenticated requests carry the user's identity and role

### Out of Scope

- In-app AI chat interface (Sprint 009)
- Model configuration / API key management (Sprint 009)
- Rate limiting on MCP access (future)
- Dry-run / preview mode for AI changes (future)

## Test Strategy

- API tests: token CRUD endpoints, token authentication, rejection of
  invalid/revoked tokens.
- MCP integration tests: connect to MCP server, list tools, call tools,
  verify changes persisted.
- Permission tests: Instructor token cannot access Quartermaster-only
  tools.
- Audit tests: AI-initiated changes recorded with prompt text.
- Database tests: token model, cascade on user deletion.

## Architecture Notes

- MCP server uses the `@modelcontextprotocol/sdk` package with
  Streamable HTTP transport mounted at `/api/mcp`.
- Tokens are opaque random strings (e.g., 32-byte hex), stored hashed
  in the database with a reference to the owning user.
- MCP tool handlers call the same service functions used by the REST
  API, ensuring consistent validation and audit logging.
- The audit log table gets two new columns: `aiGenerated` (boolean) and
  `aiPrompt` (text, nullable) to record the source prompt.
- Token auth is separate from session auth — MCP requests use a Bearer
  token header, not cookies.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
