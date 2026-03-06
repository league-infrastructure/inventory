---
id: '006'
title: MCP server setup and transport spike
status: todo
use-cases:
- SUC-003
depends-on:
- '003'
- '005'
---

# MCP server setup and transport spike

## Description

Install `@modelcontextprotocol/sdk` and set up the MCP server with
Streamable HTTP transport mounted at `/api/mcp` in the Express app.

This ticket includes a spike to verify the SDK's Streamable HTTP
transport works correctly with Express middleware mounting before
building all tools.

### Implementation

1. `npm install @modelcontextprotocol/sdk` in the server package.
2. Create `server/src/mcp/server.ts`:
   - Singleton `McpServer` instance created at startup.
   - Register one test tool (e.g., `ping`) to verify the transport.
   - Export a function to create the Express middleware handler.
3. Mount at `/api/mcp` in `app.ts`:
   - Token auth middleware runs before the MCP handler.
   - The handler creates a `ServiceRegistry` with `source: 'MCP'`
     per request, using the authenticated user's identity.
4. Verify the transport works end-to-end: authenticated request to
   `/api/mcp` can list tools and call the test tool.

### Spike acceptance

The spike is successful if an MCP client (or raw HTTP request) can:
- Connect to `/api/mcp` with a valid Bearer token
- Call `tools/list` and receive the test tool
- Call the test tool and receive a response

## Acceptance Criteria

- [ ] `@modelcontextprotocol/sdk` installed
- [ ] `server/src/mcp/server.ts` created with singleton McpServer
- [ ] MCP server mounted at `/api/mcp` with token auth middleware
- [ ] Test tool (`ping`) registered and callable
- [ ] Per-request ServiceRegistry created with `source: 'MCP'`
- [ ] Unauthenticated requests to `/api/mcp` return 401
- [ ] TypeScript compiles successfully

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: Integration test that creates a token, connects
  to `/api/mcp`, lists tools, and calls the ping tool
- **Verification command**: `npm run test:server`
