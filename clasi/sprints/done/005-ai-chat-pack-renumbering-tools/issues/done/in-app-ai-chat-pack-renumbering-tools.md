---
status: done
sprint: '005'
tickets:
- 005-001
- 005-002
---

# In-app AI chat cannot renumber packs — its tool list never got the capability

## Description

The stakeholder's in-app AI chat agent reports that pack display numbers
are not editable. Root cause: `server/src/services/ai-chat.service.ts`
maintains its own hand-rolled tool catalog, independent of the MCP
server's (`server/src/mcp/tools.ts`). Sprints 003/004 added
`renumber_pack` and `update_pack.displayNumber` to the MCP tools, but the
chat's duplicate `update_pack` definition still only accepts
`id/name/description` and the chat has no renumber tool at all.

## Requirements

1. The in-app AI chat can renumber packs: add a `renumber_pack` tool to
   the chat catalog (quartermaster-gated, like the MCP tool) and add
   `displayNumber` to the chat's `update_pack`, both delegating to
   `PackService.renumber()` — same semantics and response shape as the
   MCP versions (full renumbered pack list when a number changes, so the
   agent sees every shift).
2. Tool descriptions match the MCP versions' guidance (database id vs
   display number distinction; cross-reference between the two tools).
3. Delete-compaction (sprint 004) needs no chat change — chat's
   `delete_pack`, if present, already routes through
   `PackService.delete()` — verify and note.

## Structural note for planning

This is the second time the chat's duplicated tool catalog silently
diverged from the MCP catalog (the exact divergence class the original
pack-numbering issue was written to prevent).

**Stakeholder direction (2026-07-21, supersedes the original "patch
only" scope)**: "The in-app agent should have the same tool set as the
MCP server (actually, it should probably be using the MCP server)."
Unification is the deliverable of this sprint — one tool catalog, shared
by construction between the MCP server and the in-app chat, with the
renumbering capability arriving as a consequence. Role-filtered listing
and call-time enforcement must both be preserved.
