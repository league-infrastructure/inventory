---
status: in-progress
sprint: '010'
tickets:
- 010-001
- 010-002
- 010-003
- 010-004
- 010-005
- 010-006
---

# AI-generated labels and exports are downloadable via a link

## Description

Stakeholder request (2026-09-13): "I want to be able to say to the MCP
server, 'Get me labels,' and then it puts the labels somewhere, and then I
download them." Same for lists: "when I say 'I need a list', pop that up."

Today the assistant says it can create labels and exports but cannot hand
them over:

- `generate_labels` (server/src/mcp/tools.ts) returns PDFs as base64 MCP
  `resource` blocks. External clients such as claude.ai do not give the
  user a downloadable file from those blocks.
- The in-app AI chat (server/src/services/ai-chat.service.ts) keeps only
  `text` content from tool results, so the PDF is silently dropped.
- No MCP tool exports a list (CSV/xlsx). `ExportService` and the report
  queries exist but are only reachable from REST routes and admin pages.

## Desired behavior

1. When the assistant generates a file (labels PDF, list export), the
   server stores it and the tool returns a download link — an absolute
   URL on the inventory site — that the assistant shows to the user.
2. The user clicks the link and the browser downloads (or opens) the file.
3. Works from both surfaces: external MCP clients (claude.ai) and the
   in-app AI chat, where the link must trigger a real browser download
   rather than SPA navigation.
4. "I need a list of X" works: a list-export tool produces a CSV or xlsx
   of kits, packs, computers, or items with the same filters the list
   tools accept, using human identifiers (kit numbers, pack designators,
   host names) — never database ids — in the file.

## Proposed defaults (stakeholder may override)

- **Storage**: private objects in the existing DigitalOcean Spaces bucket
  under a generated-files prefix, plus a DB record (owner, filename, mime
  type, size, created, expires). Local disk is not durable in the Swarm
  deployment (no volumes).
- **Link**: `https://inventory.jointheleague.org/api/downloads/<random
  token>`. The token is unguessable and is not a database id.
- **Access**: the download route requires the user's normal login session
  (Google). A logged-out user is sent to login and returned to the
  download. Only the user who generated the file (or a quartermaster)
  can fetch it.
- **Retention**: files expire after 7 days; expired files are cleaned up.
- **Base URL**: a configured public URL (existing `QR_DOMAIN` /
  `APP_BASE_URL`, or a new `PUBLIC_URL`) so tools can build absolute links
  without a request object.
- `generate_labels` may keep its inline resource block for clients that
  do render it, but must also return the link.

## Notes

- Keep `generate_labels`' 60-label cap and one-PDF-per-stock-size behavior.
- Update MCP_INSTRUCTIONS and the in-app chat system prompt so the model
  presents the link instead of claiming it cannot deliver files.
- Depends on sprint 009 (kit/pack tool parameters take user numbers)
  being merged, since it edits the same tools.
