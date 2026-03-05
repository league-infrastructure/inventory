---
id: "009"
title: "AI Chat Interface and Model Integration"
status: planning
branch: sprint/009-ai-chat-interface-and-model-integration
use-cases: []
---

# Sprint 009: AI Chat Interface and Model Integration

## Goals

Add an in-app AI chat interface that lets users interact with
inventory data using natural language. The chat uses configured AI
models (OpenAI or Claude) which call back into the MCP server (built
in Sprint 008) to read and modify data.

## Problem

While Sprint 008 enables external AI models to connect to the
inventory system, users still need a way to interact with AI directly
from the application — without needing their own MCP client setup.
Users want to voice-dictate or type instructions like "add a pack
called Cables with 2 HDMI cables and 3 Ethernet cables" and have it
happen.

## Solution

- Add an AI button in the sidebar that opens a chat modal.
- The chat is a conversational interface (message history within the
  session) where users type natural language instructions.
- On submit, the server proxies the message to a configured AI model
  (OpenAI or Claude) along with context about the current page and
  user identity.
- The AI model uses MCP tools (via the Sprint 008 server) to read and
  modify inventory data, then responds with a summary of what it did.
- Admin configuration page for AI model settings (which provider, API
  keys stored as server-side secrets).

## Success Criteria

- AI button appears in the sidebar for authenticated users.
- Clicking it opens a chat modal with a text input.
- User types "create a pack called Cables with items: 2x HDMI, 1x
  USB-C adapter" and the pack is created with the correct items.
- The chat shows the AI's response summarizing what was done.
- Conversation history persists within the session (multiple
  back-and-forth messages).
- The AI receives context about the current page (e.g., which kit the
  user is viewing) so it can scope operations appropriately.
- Changes made by the AI appear immediately in the UI when the modal
  is closed or the user navigates.
- AI model configuration (provider, API key) is manageable by admins.
- All AI-initiated changes are audit-logged with the prompt text
  (using Sprint 008's audit infrastructure).

## Scope

### In Scope

- AI chat modal component (sidebar button + modal)
- Server-side AI proxy endpoint (receives user message + context,
  calls AI model, returns response)
- AI model integration (OpenAI and Anthropic Claude)
- Page context injection (current route, viewed entity ID/type)
- Model configuration UI (admin page)
- Model API key storage (server-side secrets, not exposed to client)
- Streaming responses from model to chat UI
- Session-scoped conversation history

### Out of Scope

- MCP server and token auth (completed in Sprint 008)
- Voice input / speech-to-text (browser native, user can use OS-level
  dictation)
- Persistent chat history across sessions (future)
- Multi-user collaborative AI sessions (future)
- Fine-tuning or custom model training

## Test Strategy

- API tests: AI proxy endpoint accepts message, returns response;
  rejects unauthenticated requests; handles model errors gracefully.
- Integration tests: mock AI model responses, verify MCP tool calls
  are made correctly.
- Frontend tests: chat modal opens/closes, messages render, input
  submits correctly.
- E2E tests: full flow from chat input to data change visible in UI.

## Architecture Notes

- The AI proxy endpoint (`POST /api/ai/chat`) receives `{ message,
  context, conversationHistory }` and streams the response using SSE.
- The server creates an MCP client that connects to its own MCP
  server (localhost), authenticated with the user's auto-generated
  token.
- The AI model receives a system prompt describing available tools
  (from MCP tool list) plus the page context, then the user's message.
- API keys are stored in the database (encrypted) or as environment
  variables / Docker secrets — never sent to the client.
- The chat modal is a React component that maintains conversation
  state and renders messages in a scrollable container.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
