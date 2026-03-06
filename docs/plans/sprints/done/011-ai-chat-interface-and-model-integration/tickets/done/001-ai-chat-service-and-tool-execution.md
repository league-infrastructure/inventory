---
id: '001'
title: AI Chat Service and Tool Execution
status: done
use-cases:
- SUC-011-001
- SUC-011-002
depends-on: []
---

# AI Chat Service and Tool Execution

## Description

Create the server-side AI chat service that integrates with the Anthropic
Claude API. The service accepts user messages, builds a system prompt with
MCP tool definitions, calls Claude, executes tool calls via the service
layer, and returns the response.

## Acceptance Criteria

- [x] Install `@anthropic-ai/sdk` dependency
- [x] `ANTHROPIC_API_KEY` added to `.env.template` and secrets
- [x] `AiChatService` class created in `server/src/services/`
- [x] Service extracts tool definitions from MCP tools module
- [x] Service converts MCP tool schemas to Anthropic tool format
- [x] Service calls Claude API with system prompt, tools, and messages
- [x] Service executes tool calls via ServiceRegistry (direct calls)
- [x] Service handles multi-turn tool use (tool call → result → continue)
- [x] Role-based tool filtering: Instructors get read-only tools,
  Quartermasters get all tools
- [x] Service returns streaming text response

## Testing

- Unit test: tool schema conversion
- Unit test: role-based tool filtering
- Integration test with mocked Anthropic API: message → tool call → response
- Verify in `tests/server/`

## Implementation Notes

- Reuse the tool handler functions from `server/src/mcp/tools.ts` but
  call them directly rather than going through the MCP HTTP transport.
- Extract the tool definitions (name, description, inputSchema) into a
  shared helper so both MCP server and AI chat can use them.
- System prompt should describe the inventory system and available tools.
