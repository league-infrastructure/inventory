---
id: '031'
title: AI Chat Context and MCP Server Info
status: done
branch: sprint/031-ai-chat-context-and-mcp-server-info
use-cases:
- SUC-031-001
- SUC-031-002
---

# Sprint 031: AI Chat Context and MCP Server Info

## Goals

1. Give the web AI chat assistant awareness of the page the user is
   currently viewing so it can answer questions in context.
2. Expose application version and server hostname through the MCP
   `get_version` tool so AI agents can report deployment info.

## Problem

1. **AI Chat lacks page context**: When a user opens the chat widget on a
   kit or computer detail page and asks "what issues does this have?", the
   assistant has no idea what "this" refers to. The user must explicitly
   name the entity every time.

2. **MCP server info incomplete**: The `get_version` MCP tool returns only
   the app name and version. AI agents (Claude Code, Slack bot) cannot
   determine which server the app is running on without shelling out to
   inspect Docker contexts.

## Solution

1. **Page context**: The `AiChat` React component extracts the current
   route (via `useLocation`, already imported) and resolves it to an entity
   type/id. It fetches the entity name and passes a `pageContext` object
   alongside the chat message. The backend injects this into the system
   prompt so the AI knows "the user is viewing Kit #17 — Robot Kit".

2. **Server info**: Extend the existing `get_version` MCP tool to also
   return `os.hostname()` and `process.env.NODE_ENV`. Update the tool
   description so agents know to call it when asked about server hostname
   or deployment environment.

## Success Criteria

- Asking "what issues does this kit have?" on a kit detail page returns
  issues for that specific kit without the user naming it.
- The `get_version` MCP tool returns hostname and environment.
- Tool description mentions hostname so agents discover it naturally.

## Scope

### In Scope

- Frontend: extract entity context from current URL in AiChat component
- Backend: accept `pageContext` in `/api/ai/chat` request
- Service: inject page context into AI system prompt
- MCP: extend `get_version` to include hostname and environment

### Out of Scope

- Slack bot context (already has its own context mechanism)
- Passing full entity data (just type, id, and name are sufficient)
- Changing the MCP tool name or creating a separate tool

## Test Strategy

- Manual testing: open chat on kit/computer detail pages and verify
  context-aware responses.
- Verify `get_version` MCP tool returns hostname via MCP client.

## Architecture Notes

- `useLocation()` is already imported in AiChat.tsx.
- URL patterns are deterministic: `/kits/:id`, `/computers/:id`, etc.
- The AI chat service already builds a dynamic system prompt with user
  context — page context slots in alongside it.
- The system prompt template uses mustache-style placeholders.

## Definition of Ready

- [x] Sprint planning documents are complete
- [x] Architecture review passed
- [x] Stakeholder has approved the sprint plan

## Tickets

- 001: Pass page context from chat widget to AI backend
- 002: Extend MCP get_version tool with hostname and environment
