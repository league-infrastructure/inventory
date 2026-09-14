---
id: '004'
title: Rewrite MCP_INSTRUCTIONS and add drift-guard assertion
status: done
use-cases:
- SUC-003
depends-on:
- '002'
- '003'
github-issue: ''
issue: mcp-tools-must-use-user-facing-identifiers-not-database-ids.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Rewrite MCP_INSTRUCTIONS and add drift-guard assertion

## Description

Two closing tasks for the sprint, both gated on tickets 002 and 003
having converted every in-scope kit/pack tool:

1. **Rewrite `MCP_INSTRUCTIONS` in `server/src/mcp/server.ts`.** Rule 2
   ("Kits have a user-facing number field AND a database id... Always
   look up and refer to kits by number") and rule 5 ("Use database IDs
   internally to call tools") describe a hazard that no longer exists
   once kit/pack tool parameters take numbers directly — rule 5 in
   particular becomes actively wrong, since there is no id-based path
   left for kits/packs to use "internally." Replace both with guidance
   matching the corrected interface (e.g., stating plainly that kit and
   pack tools take the kit number / pack number directly, with no
   separate id to look up). Retain what is still true and unconverted:
   rule 1 (never mention database ids unless asked), rule 3
   (computers/sites identified by name), rule 4 (sort/search/report by
   human-meaningful fields). Do not leave any instruction that
   contradicts the new tool schemas.

2. **Extend the drift guard.** Add a new assertion to
   `tests/server/services/mcp-tool-metadata.test.ts` (reusing the
   existing fake-collector pattern documented in that file's own
   header comment) that no kit- or pack-identifying parameter, on the
   tools converted in tickets 002/003, is registered with a name
   matching `/id$/i` (case-insensitive). Scope the assertion to the
   specific converted tools/params — not a blanket "no schema anywhere
   may end in id" — since legitimate id parameters remain by design
   elsewhere (`imageId`, `objectId`, `custodianId`, `siteId`,
   `hostNameId`, computer/site/OS ids, etc.), and this sprint does not
   touch them.

## Acceptance Criteria

- [x] `MCP_INSTRUCTIONS` no longer contains kit-number-vs-database-id
      mapping guidance; the model is not instructed to use database ids
      "internally" for kit/pack tools.
- [x] Rules 1, 3, 4 (or their equivalents) are retained for identifiers
      this sprint does not touch (sites, OS, host names, computers by
      name, images/notes/issues/items).
- [x] `tests/server/services/mcp-tool-metadata.test.ts` has a new,
      passing assertion that fails if any tool converted in tickets
      002/003 is registered with a kit/pack parameter matching
      `/id$/i`.
- [x] The existing `_meta.requiresQM` assertions in that same test file
      still pass unmodified.
- [x] Both-surfaces verification (SUC-003): at least one converted tool
      is exercised through the MCP HTTP path and through the in-app AI
      chat path (`ai-chat.service.ts`'s `withMcpClient`), confirming
      consistent results — extend
      `tests/server/services/ai-chat-mcp-unification.test.ts` or
      `ai-chat.service.test.ts` if no existing case covers a converted
      kit/pack tool. **Satisfied by existing ticket-003 tests**, no
      extension needed: `ai-chat-mcp-unification.test.ts`'s "renumber_pack
      via chat matches the direct MCP tool call for the same starting
      state and input, audited as MCP" (and its update_pack/delete_pack
      siblings) already exercise a converted pack tool (`renumber_pack`,
      a pack designator param) through both the direct-handler path
      (this codebase's established stand-in for the MCP path — the same
      `registerTools()` fake-collector convention used by
      `mcp-kit-tools.test.ts`, `mcp-pack-tools.test.ts`,
      `mcp-renumber-pack.test.ts`, `labels.test.ts`, and
      `computers.test.ts`; no test in this suite makes a literal HTTP
      round-trip to `/api/mcp` with an authenticated tool call) and
      `AiChatService.withMcpClient()`, asserting identical results.
- [ ] `npm run test:server` shows no new failures relative to the
      tracked pre-existing baseline (309 passed / 41 failed / 350
      total). **Left unchecked per instruction**: verified once at
      `close_sprint` for the whole sprint, not re-run per ticket.

## Implementation Plan

**Approach**: Prompt rewrite is a self-contained edit to one string
constant. The drift-guard assertion follows the same fake-collector
pattern already used in `mcp-tool-metadata.test.ts` (a minimal object
exposing `.tool()`/`.registerTool()` that records each registration's
name and schema shape, passed to the real `registerTools()`) — extend
that collector to also capture each tool's raw zod shape (currently it
only records `name`, `meta`, and `handler`), then assert over the
known-converted tool/parameter list from tickets 002 and 003.

**Files to modify**:
- `server/src/mcp/server.ts` — `MCP_INSTRUCTIONS`.
- `tests/server/services/mcp-tool-metadata.test.ts` — new drift-guard
  assertion (and, if needed, an extension to the fake collector to
  capture schema shape, not just name/meta/handler).
- `tests/server/services/ai-chat-mcp-unification.test.ts` or
  `ai-chat.service.test.ts` — a both-surfaces test case for at least one
  converted tool, if none already exists.

**Testing plan**:
- Run the extended drift-guard test against the post-ticket-002/003
  codebase to confirm it passes (and, ideally, temporarily verify it
  would have failed against the pre-conversion schema, to prove it
  actually guards something).
- Run the both-surfaces test case.
- Full `npm run test:server` as the sprint-wide final regression check.

**Documentation updates**: none beyond `MCP_INSTRUCTIONS` itself, which
is the living documentation of tool-usage rules for the model.

## Testing

- **Existing tests to run**: full `npm run test:server` (final
  sprint-wide regression check against the tracked baseline).
- **New tests to write**: the drift-guard assertion described above; a
  both-surfaces test case per SUC-003.
- **Verification command**: `npm run test:server`.
