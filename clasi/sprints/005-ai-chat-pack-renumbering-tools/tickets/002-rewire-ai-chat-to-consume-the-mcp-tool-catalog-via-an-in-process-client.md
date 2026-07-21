---
id: '002'
title: Rewire AI chat to consume the MCP tool catalog via an in-process client
status: open
use-cases:
- SUC-001
- SUC-002
depends-on:
- '001'
github-issue: ''
issue: in-app-ai-chat-pack-renumbering-tools.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Rewire AI chat to consume the MCP tool catalog via an in-process client

## Description

Depends on ticket 001 (`_meta.requiresQM` annotations + exported
`createMcpServer`). This ticket is the actual deliverable: the in-app AI
chat (and Slack, which shares `AiChatService`) stops maintaining its own
tool catalog and instead becomes an in-process MCP client of the same
`McpServer` external clients use. Pack renumbering
(`renumber_pack`/`update_pack.displayNumber`) arrives as a consequence —
no pack-specific code is added to `ai-chat.service.ts`. Full rationale,
the component diagram, and the design decisions (option (b) vs (a),
`mcpContext` threading proof, per-call server/client lifecycle,
`_meta` vs `annotations`, `isError` → `is_error` mapping) are in the
sprint's Architecture section — read it before implementing; this
ticket does not repeat that reasoning, only the resulting work.

**Approach** (in `server/src/services/ai-chat.service.ts`):

1. Delete `getToolDefinitions()` and `executeTool()` entirely — no
   trace of a second tool table should remain.
2. In `chat()`, at the top of the method body, create a fresh
   `McpServer` (via the now-exported `createMcpServer()` from
   `server/src/mcp/server.ts`), a linked in-process transport pair
   (`InMemoryTransport.createLinkedPair()` from
   `@modelcontextprotocol/sdk/inMemory.js`), and a `Client`
   (`@modelcontextprotocol/sdk/client/index.js`); connect server to one
   transport and client to the other.
3. Wrap the remainder of `chat()`'s body (the `listTools()` call and the
   entire agentic `while (true)` loop, including every `callTool()`) in
   a single `mcpContext.run({ user, services }, async () => { ... })` —
   one `run()` per `chat()` invocation, matching `createMcpHandler`'s
   existing per-HTTP-request shape. `services` is the parameter `chat()`
   already receives; `chat()`'s public signature does not change.
4. Replace `getToolsForRole(role)`'s body: call `client.listTools()`
   once, filter to tools where `tool._meta?.requiresQM` is not `true`
   (or keep all tools for a QM-role user), map each to
   `{ name, description, input_schema: tool.inputSchema }` for
   Anthropic. This method becomes `async`
   (`getToolsForRole(role: string): Promise<Anthropic.Tool[]>`) — update
   its one call site inside `chat()` to `await` it.
5. Replace the tool-execution step inside the `while (true)` loop:
   instead of calling the local `executeTool(name, input, services,
   user)`, call `await client.callTool({ name: block.name, arguments:
   block.input })`. Map the result to the Anthropic tool-result block:
   `content` = the joined text of the result's `content` array (each
   entry's `.text` where `type === 'text'`), `is_error` = the result's
   `isError` (boolean, may be `undefined` → omit or pass `false`).
6. On loop exit (success or thrown error), close the client and server
   (`await client.close()`, `await server.close()`) in a `finally` block
   so no per-request resource lingers.
7. Housekeeping: append a short, additive mention of the newly-reachable
   tool categories (Operating Systems, Images, Notes, `get_version`) to
   `server/src/prompts/ai-chat-system.txt`'s "Key concepts" list (per
   the sprint's Open Questions default — accepted by the stakeholder).
   Leave `screenMessage()`'s screening prompt unchanged (also an accepted
   default — its "general questions about the system" clause already
   covers the new categories).

**Files to modify**:
- `server/src/services/ai-chat.service.ts` (the rewire itself)
- `server/src/prompts/ai-chat-system.txt` (additive system-prompt note)
- `tests/server/services/ai-chat.service.test.ts` (update/replace tests
  that call the now-deleted `getToolDefinitions`/`executeTool` or the
  now-async `getToolsForRole`)

**Files to create**:
- A new test file exercising the unified chat tool path against a real
  `ServiceRegistry` and test DB (e.g.
  `tests/server/services/ai-chat-mcp-unification.test.ts`), reusing the
  `setupTestUser`/`getRegistry`/`getPrisma`/`getUserId`/`getSuffix`
  fixtures from `tests/server/services/setup.ts` per the sprint's Test
  Strategy.

## Acceptance Criteria

- [ ] `ai-chat.service.ts` no longer defines `getToolDefinitions()` or
      `executeTool()`.
- [ ] For both `QUARTERMASTER` and `INSTRUCTOR` roles, the chat's
      resulting tool list (name + `input_schema`) is exactly the
      QM-filtered subset of the MCP server's own `tools/list` output —
      asserted by structural comparison (e.g. sorted name arrays plus a
      spot check that schemas match), not by checking a hand-picked
      sample of tool names.
- [ ] A QM-gated tool (e.g. `renumber_pack`) called by a non-QM-role
      chat user is rejected with the same "Quartermaster access
      required" error the MCP HTTP path produces — this is a new
      call-time check for the chat path (today's `executeTool()` has
      none; only list-time filtering exists today), so the test must
      actually attempt the call and observe the rejection, not just
      check that the tool is absent from the list.
- [ ] `renumber_pack` (and `update_pack` with `displayNumber`), reached
      via the chat's new execution path, delegate to
      `services.packs.renumber(...)` and return the kit's full,
      freshly-ordered pack list — same final `1..N` assignment as an
      equivalent direct MCP tool call for the same starting state and
      input (structural comparison, mirroring
      `tests/server/services/mcp-renumber-pack.test.ts`), and the
      resulting audit rows record `source: 'MCP'`.
- [ ] `update_pack` with only `name`/`description` (no `displayNumber`),
      reached via the chat's new path, still returns a single pack
      record with no renumber side effect.
- [ ] `delete_pack`, reached via the chat's new path, still calls
      `services.packs.delete()` (delete-time compaction from sprint
      004 applies) — confirmed by test, not assumed.
- [ ] A successful tool call's result reaches the Anthropic loop as
      `{ type: 'tool_result', tool_use_id, content, is_error }` with
      `is_error` sourced from the MCP `CallToolResult.isError` (a
      deliberate improvement over today's implicit error convention).
- [ ] `chat()`'s public signature (parameters and return type) is
      unchanged; `getToolsForRole` is the one deliberate breaking change
      (sync → `async`), with no callers outside this module and its own
      tests (confirmed during planning by repo-wide search) needing
      updates beyond this ticket's own test file.
- [ ] `server/src/prompts/ai-chat-system.txt` mentions Operating
      Systems, Images, and Notes among its key concepts.
- [ ] Client/server/transport resources created per `chat()` call are
      closed when the call completes (success or error path).

## Testing

- **Existing tests to run**: `tests/server/ai-chat.test.ts`,
  `tests/server/services/ai-chat.service.test.ts` (both updated in this
  ticket — the `isConfigured` and `chat()`-throws-when-unconfigured
  tests are unaffected and should still pass unmodified),
  `tests/server/services/mcp-renumber-pack.test.ts` (regression check —
  this ticket does not touch `mcp/tools.ts`'s handlers, only adds a new
  consumer). Run with `--maxWorkers=2` per the project's known
  flakiness baseline (18 pre-existing failures in
  app/auth/github/pike13/integrations/issue.service, plus latent
  `inventory-check.service` flakiness — unrelated to this ticket).
- **New tests to write**:
  1. Catalog-identity test: build the MCP tool list (fake-collector
     pattern or a real client/server pair) and the chat's
     `getToolsForRole('QUARTERMASTER')` /
     `getToolsForRole('INSTRUCTOR')`, assert the chat's list is exactly
     the QM-filtered subset for each role.
  2. QM-gating end-to-end test: an `INSTRUCTOR`-role `chat()`-style call
     to `renumber_pack` (via whatever seam this ticket exposes for
     testing without the Anthropic API — e.g. directly exercising the
     new client-wiring helper) is rejected with the QM error.
  3. Delegation/semantics tests for `renumber_pack`, `update_pack`
     (with and without `displayNumber`), and `delete_pack`, against a
     real `ServiceRegistry`/test DB, following
     `mcp-renumber-pack.test.ts`'s fixtures and assertion style
     (contiguity, structural comparison against the direct-MCP result,
     audit `source: 'MCP'`).
  4. `is_error` mapping test: a failing tool call (e.g. nonexistent
     pack ID) produces a tool-result block with `is_error: true`.
- **Verification command**: `npm run test:server -- --maxWorkers=2`
  (root `package.json`'s `test:server` script:
  `cd server && npx jest --config ../tests/server/jest.config.js`).
