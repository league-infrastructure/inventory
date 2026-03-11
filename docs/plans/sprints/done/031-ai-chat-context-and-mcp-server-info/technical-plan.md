---
status: approved
from-architecture-version: null
to-architecture-version: null
---

# Sprint 031 Technical Plan

## Architecture Overview

Two independent changes, both additive and low-risk.

## Component Design

### Component: Page Context in AI Chat

**Use Cases**: SUC-031-001

**Frontend** (`client/src/components/AiChat.tsx`):
- Add `getPageContext()` that parses `location.pathname` against known
  URL patterns (`/kits/:id`, `/computers/:id`, `/packs/:id`, `/sites/:id`)
- Send `pageContext: { page, entityType, entityId }` in POST body

**Backend Route** (`server/src/routes/ai-chat.ts`):
- Accept optional `pageContext` in request body
- Pass through to `aiChat.chat()`

**Service** (`server/src/services/ai-chat.service.ts`):
- Accept `pageContext` in `chat()` and `buildSystemPrompt()`
- When present, add a section to the system prompt telling the AI what
  entity the user is currently viewing
- Use the service layer to look up the entity name from the ID

**Prompt** (`server/src/prompts/ai-chat-system.txt`):
- Add `{{pageContext}}` placeholder that gets replaced with context info

### Component: MCP get_version Enhancement

**Use Cases**: SUC-031-002

**MCP Tools** (`server/src/mcp/tools.ts`):
- Import `os` module
- Add `hostname: os.hostname()` and `environment: process.env.NODE_ENV`
  to the `get_version` response
- Update tool description to mention hostname and environment

## Files Modified

| File | Change |
|------|--------|
| `client/src/components/AiChat.tsx` | Add page context extraction |
| `server/src/routes/ai-chat.ts` | Accept pageContext parameter |
| `server/src/services/ai-chat.service.ts` | Inject pageContext into prompt |
| `server/src/prompts/ai-chat-system.txt` | Add pageContext placeholder |
| `server/src/mcp/tools.ts` | Extend get_version response |

## Open Questions

None.
