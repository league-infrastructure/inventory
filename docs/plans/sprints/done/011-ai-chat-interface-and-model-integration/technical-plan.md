---
status: approved
---

# Sprint 011 Technical Plan

## Architecture Overview

The AI chat system adds three components:

1. **AI Chat Endpoint** — A new Express route (`POST /api/ai/chat`)
   that receives user messages, constructs a prompt with MCP tool
   definitions, calls the Anthropic Claude API, executes any tool
   calls against the local MCP tools, and streams the response back
   via Server-Sent Events (SSE).

2. **AI Chat Modal** — A React component accessible from the sidebar
   that provides a conversational interface with message history,
   streaming text display, and input handling.

3. **AI Configuration** — The Anthropic API key is provided via the
   `ANTHROPIC_API_KEY` environment variable (or Docker secret). No
   admin UI is needed for MVP — environment configuration is
   sufficient.

```
User → Chat Modal → POST /api/ai/chat (SSE)
                         ↓
                    Anthropic API (Claude)
                         ↓
                    Tool calls → ServiceRegistry (direct)
                         ↓
                    Stream response back to client
```

## Component Design

### Component 1: AI Chat Service (`server/src/services/ai-chat.service.ts`)

**Use Cases**: SUC-011-001, SUC-011-002, SUC-011-004

Server-side service that orchestrates AI conversations:

- Accepts user message and conversation history.
- Builds system prompt with available MCP tool definitions extracted
  from the MCP tools module (reuse tool schemas from `mcp/tools.ts`).
- Calls the Anthropic API using the `@anthropic-ai/sdk` package.
- When the model requests tool calls, executes them directly via the
  ServiceRegistry (not over HTTP — direct function calls to the same
  service layer the MCP tools use).
- Streams text responses back to the caller.
- Enforces role-based access: read-only tools for Instructors,
  full access for Quartermasters.

### Component 2: AI Chat Route (`server/src/routes/ai-chat.ts`)

**Use Cases**: SUC-011-001, SUC-011-004

Express route handler:

- `POST /api/ai/chat` — Requires session auth. Accepts
  `{ message, conversationHistory }`. Opens an SSE stream. Calls
  AiChatService to process the message. Streams text deltas as
  `data: { type: "delta", text: "..." }` events. Sends
  `data: { type: "done" }` at completion. Sends
  `data: { type: "error", error: "..." }` on failure.

### Component 3: Chat Modal (`client/src/components/AiChat.tsx`)

**Use Cases**: SUC-011-001, SUC-011-004

React component:

- Floating action button in the bottom-right corner (or sidebar
  button) that toggles a chat panel.
- Message list with user/assistant message bubbles.
- Text input with send button.
- Manages conversation history in component state.
- Sends messages via `fetch` with streaming response handling
  (`ReadableStream`).
- Shows typing indicator while streaming.
- Auto-scrolls to latest message.
- Clears history when closed (session-scoped).

### Component 4: AI Configuration via Environment

**Use Cases**: SUC-011-003

- `ANTHROPIC_API_KEY` environment variable (added to `.env.template`
  and secrets).
- The AI chat service checks for the key on startup and disables the
  chat endpoint if not configured.
- The chat button is hidden in the UI when the endpoint returns a
  "not configured" status.
- A health-check endpoint `GET /api/ai/status` returns whether AI
  is configured (no key details exposed).

## Key Design Decisions

1. **Direct service calls, not MCP over HTTP**: The AI chat service
   calls the same service functions that MCP tools use, but directly
   (no HTTP round-trip). This is faster and avoids token management
   complexity for internal calls. The MCP tool definitions are reused
   for the Claude tool schema.

2. **Anthropic SDK only**: The sprint doc mentions OpenAI, but we'll
   focus on Anthropic Claude since that's what's available and the
   MCP tool-use protocol is native to Claude.

3. **SSE for streaming**: Standard EventSource-compatible streaming.
   Simple, well-supported, no WebSocket complexity.

4. **Session auth for chat**: The chat endpoint uses the same session
   auth as the rest of the app (not token auth). The user's role
   determines which tools are available.

## Dependencies

- `@anthropic-ai/sdk` — Anthropic's official Node.js SDK

## Open Questions

None — design is straightforward given existing infrastructure.
