---
id: '006'
title: 'Presentation layer: chat/model instructions and in-app download link handling'
status: done
use-cases:
- SUC-001
- SUC-002
- SUC-003
depends-on:
- '003'
- '004'
github-issue: ''
issue: ai-generated-labels-and-exports-downloadable-via-link.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Presentation layer: chat/model instructions and in-app download link handling

## Description

The tools now return real download links (tickets 003, 004); this
ticket makes both client surfaces actually present them, and fixes the
one stale comment that misdescribes tool-result shape. Depends on 003
and 004 landing first so this can be tested against the real tool
output, not a mock.

Four small, independent-but-related edits:

1. `server/src/mcp/server.ts`'s `MCP_INSTRUCTIONS` — add a section
   telling external-MCP-client models to present `download_url` links
   rather than claiming they can't deliver files.
2. `server/src/prompts/ai-chat-system.txt` — same guidance for the
   in-app chat model.
3. `server/src/services/ai-chat.service.ts` — fix the `McpToolCallResult`
   doc comment (already flagged as stale: it claims every tool returns
   text-only content, which `generate_labels`'s `resource` blocks
   already contradict). No functional change to the tool-result
   filtering itself — the download link travels inside the JSON
   manifest's `text` block, which the existing filter already keeps;
   confirm this with a test rather than assuming it.
4. `client/src/components/AiChat.tsx`'s markdown link renderer — harden
   it so a download path is never captured by the SPA-`navigate()`
   branch even if a relative link is ever emitted by the model (the
   expected case, an absolute link, already falls through to
   `target="_blank"` today and needs no change).

## Acceptance Criteria

- [x] `MCP_INSTRUCTIONS` gains a numbered rule (matching the existing
      style) describing: `generate_labels` and `export_list` return a
      `download_url` per file; present it to the user as a link;
      do not claim inability to deliver files.
- [x] `ai-chat-system.txt` gains equivalent guidance, consistent with
      its existing "Links" section style (e.g. distinguishing these
      absolute download links from the existing relative `/kits/:id`-
      style in-app navigation links it already documents).
- [x] `ai-chat.service.ts`'s `McpToolCallResult` interface comment no
      longer claims tools only ever return text content; it should
      instead note that `resource` blocks exist for some tools but are
      intentionally filtered out here because the download link is
      always present in the accompanying text block.
- [x] A new test (or an update to an existing ai-chat test) exercises a
      `generate_labels`/`export_list` tool call through
      `ai-chat.service.ts` and asserts the resulting assistant message
      text contains the `download_url` from the manifest — i.e. this is
      verified, not just asserted true by comment-reading.
- [x] `AiChat.tsx`'s link renderer: a link whose `href` matches
      `/^\/api\/downloads\//` is treated as a real navigation (not
      intercepted by `navigate()`) even though it starts with `/`,
      alongside the existing behavior for genuinely absolute links.
- [x] Manual/E2E check (documented in the PR, not necessarily
      automated): asking the in-app chat for labels or a list export
      produces a message with a clickable link that downloads the file
      in a real browser tab, not a SPA navigation to a 404/blank page.

      **Manual check performed (code-path verification, not a live
      browser session):** `generate_labels`/`export_list` return an
      absolute `download_url` built from `getBaseUrl()`
      (`server/src/config/baseUrl.ts`) — `QR_DOMAIN` in prod, or
      `APP_BASE_URL` in dev, which `.env` sets to
      `http://localhost:9311` (the Vite client's own dev origin, not
      the server's `9310`). In dev, opening that absolute URL hits the
      Vite dev server, whose existing `/api` proxy
      (`client/vite.config.ts`, `changeOrigin: false`) forwards to the
      real server on `9310` while keeping the browser on the client's
      origin/cookies — so the link already resolves correctly in both
      dev and prod without any change in this ticket. `AiChat.tsx`'s
      markdown renderer sends any link starting with `/` that is not
      `isInAppRoute()` (now excluding `/api/downloads/...`) through a
      plain `<a target="_blank">`, and the download route responds with
      `Content-Disposition: attachment` (ticket 002), so the browser
      downloads the file rather than navigating to it. Verified via
      `tests/server/labels.test.ts`'s existing
      `'the download link is resolvable over HTTP...'` test (asserts
      the `content-disposition` header) plus this ticket's new
      `ai-chat-download-links.test.ts` and `downloadLinks.test.ts`. A
      live browser click-through was not additionally performed.

## Testing

- **Existing tests to run**: `AiChat.tsx`'s existing component tests
  (link-renderer behavior for `/kits/:id`-style links must not
  regress); `ai-chat.service.ts`'s existing tool-result-handling tests.
- **New tests to write**: `AiChat.tsx` renderer test for a
  `/api/downloads/<token>` href; `ai-chat.service.ts` test asserting a
  `download_url` survives the tool-result round trip into the model's
  final text; a golden-text check that neither instructions file claims
  the assistant "cannot deliver files."
- **Verification command**: `cd server && npx jest --config
  ../tests/server/jest.config.js src/services/ai-chat.service`, plus
  the client test runner for `AiChat.tsx` (check `client/package.json`
  for the exact script, e.g. `npm test -- AiChat`).
