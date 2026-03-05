# MCP Server and AI Chat Interface

## Summary

Expose the inventory application as an MCP server so external AI models
can interact with it programmatically. Add an in-app AI chat interface
that uses the same MCP server under the hood.

## Core Components

### 1. MCP Server (runs on the web application)

- Exposes inventory operations as MCP tools: edit kits, packs, items,
  computers, host names, sites; check-in/check-out; read current state
- URL-addressable — users give the MCP server URL to external language
  models (Claude, OpenAI, etc.) which can then operate on inventory data
- All operations go through the existing API layer with the caller's
  permissions

### 2. Token-Based Authentication

- Users can create personal API tokens from the UI (token management page)
- Tokens carry the user's role/permissions (Instructor vs Quartermaster)
- External AI models authenticate to the MCP server using these tokens
- Tokens are revocable and auditable

### 3. AI Audit Trail

- Every AI-initiated change is flagged in the audit log as AI-produced
- Store the full submitted text/prompt that triggered the changes
- Record which model was used, the token used, and the complete request
  so there's a forensic trail of what happened

### 4. In-App AI Chat Interface

- AI button in the sidebar opens a modal chat window
- Chat-style interface (not just a single text box) — conversation
  history within the session
- User types natural language instructions ("add a pack called
  'Cables' with items: 2x HDMI, 1x USB-C, 3x Ethernet")
- The chat uses a configured model (OpenAI or Claude, user-selectable)
- The model receives context about: current page, current user, user's
  token
- The model calls back into the MCP server using tools to make changes
- Changes appear live in the UI

### 5. Model Configuration

- User or admin configures which AI models are available (OpenAI, Claude)
- API keys stored as secrets (not in client)
- Model calls are proxied through the server (keys never exposed to browser)

## Architecture Notes

- The MCP server is the single integration point — both external models
  and the in-app chat use the same tool surface
- In-app flow: User chat → Server-side model call (with page context +
  user token) → Model uses MCP tools → Changes applied → Response
  streamed back to chat
- External flow: External model → MCP server URL + token → MCP tools →
  Changes applied
- All writes go through the same permission checks and audit logging as
  the regular UI

## Open Questions

- MCP transport: SSE (Streamable HTTP) for external access?
- Token format: JWT, opaque random token, or something else?
- Should the in-app chat support streaming responses?
- Rate limiting on token-authenticated MCP access?
- Should there be a "dry run" mode where the AI shows proposed changes
  before applying them?
