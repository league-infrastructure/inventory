---
id: '001'
title: Export createMcpServer + add QM-visibility metadata to MCP tools
status: in-progress
use-cases:
- SUC-001
depends-on: []
github-issue: ''
issue: in-app-ai-chat-pack-renumbering-tools.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Export createMcpServer + add QM-visibility metadata to MCP tools

## Description

Foundation ticket for sprint 005's catalog unification (see the sprint's
Architecture section for full rationale). This ticket makes no change to
`ai-chat.service.ts` — it only prepares `server/src/mcp/` so a second,
in-process consumer (built in ticket 002) can (a) obtain an `McpServer`
instance and (b) tell, per tool, whether that tool requires
Quartermaster access, without re-deriving that from each handler's body.

Two changes, both mechanical and behavior-preserving for the existing
HTTP MCP path:

1. **Export the server factory.** `server/src/mcp/server.ts`'s
   `createMcpServer()` is currently a module-private function called
   only by `createMcpHandler()`. Export it (`export function
   createMcpServer(): McpServer`) with no change to its body.
   `createMcpHandler()` itself is unchanged.
2. **Annotate QM-gated tools.** In `server/src/mcp/tools.ts`, every
   `server.tool(...)` registration whose handler calls `requireQM()`
   gains a `_meta: { requiresQM: true }` argument (the SDK's `tool()`
   overloads accept an options object with `annotations`/`_meta` in the
   position before the callback — see
   `server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts`
   lines ~119-156). Tools whose handler does *not* call `requireQM()`
   (e.g. `list_sites`, `get_kit`, `transfer_kit`) get no `_meta` (or an
   explicit `_meta: { requiresQM: false }` — either is acceptable, see
   Acceptance Criteria for the exact invariant being tested). No handler
   body changes; this is annotation-only.

This `_meta` value is confirmed (by reading the SDK's actual source,
`server/mcp.js` line 86: `_meta: tool._meta`) to be included verbatim in
the `tools/list` response — i.e. any client, including the in-process
one ticket 002 builds, can read it without any further plumbing.

## Acceptance Criteria

- [x] `createMcpServer` is exported from `server/src/mcp/server.ts`;
      `createMcpHandler`'s behavior is unchanged (existing MCP HTTP
      tests, if any, and manual smoke-check of `POST /mcp` continue to
      pass).
- [x] Every tool in `server/src/mcp/tools.ts` whose handler calls
      `requireQM()` declares `_meta: { requiresQM: true }` at its
      `server.tool(...)` registration call.
- [x] No tool whose handler does *not* call `requireQM()` declares
      `_meta.requiresQM === true`.
- [x] A new test enumerates every registered tool (via the fake-collector
      pattern already used in
      `tests/server/services/mcp-renumber-pack.test.ts` — a minimal
      object exposing `.tool(name, ...rest)` that records each
      registration, passed to `registerTools()`) and asserts, for each
      one: `tool._meta?.requiresQM === true` if and only if calling its
      handler without QM role throws "Quartermaster access required".
      This is the drift-guard the whole sprint exists to add — it must
      fail if a future tool adds a `requireQM()` call without the
      matching annotation, or vice versa.
- [x] No existing MCP tool test (`tests/server/services/mcp-renumber-pack.test.ts`,
      any others under `tests/server/services/` exercising `registerTools`)
      regresses.
- [x] No change to any tool's response shape, error behavior, or
      `requireQM()` call — this ticket is additive metadata only.

## Testing

- **Existing tests to run**: `tests/server/services/mcp-renumber-pack.test.ts`
  and any other test importing `registerTools` from
  `server/src/mcp/tools.ts`; run with `--maxWorkers=2` (project's known
  flakiness baseline — 18 pre-existing failures in
  app/auth/github/pike13/integrations/issue.service, plus latent
  `inventory-check.service` flakiness, all unrelated to this ticket).
- **New tests to write**: the drift-guard invariant test described above
  (new file, e.g. `tests/server/services/mcp-tool-metadata.test.ts`),
  using the fake-collector pattern to register the real catalog and
  iterate every tool, invoking each handler once with a non-QM
  (`INSTRUCTOR`) `mcpContext` to observe whether it throws, then
  comparing that observation against the tool's declared `_meta`. Tools
  that require arguments beyond what a bare `{}` call provides may need
  a minimal valid-shaped input (or a caught validation error to be
  distinguished from a QM-rejection error) — use `mcp-renumber-pack.test.ts`'s
  existing fixtures (`setupTestUser`, `getRegistry`, `getPrisma`) to seed
  any data a handler needs to reach its `requireQM()` check.
- **Verification command**: `npm run test:server -- --maxWorkers=2`
  (root `package.json`'s `test:server` script:
  `cd server && npx jest --config ../tests/server/jest.config.js`).
