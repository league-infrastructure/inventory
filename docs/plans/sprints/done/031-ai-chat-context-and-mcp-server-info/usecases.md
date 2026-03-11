---
status: approved
---

# Sprint 031 Use Cases

## SUC-031-001: AI Chat Page Context

**Actor**: Authenticated user viewing a detail page

**Preconditions**: User is on a kit, computer, pack, or site detail page
with the chat widget open.

**Main Flow**:
1. User types a question referencing "this" entity (e.g., "what issues
   does this kit have?").
2. The chat widget extracts the entity type and ID from the current URL.
3. The widget sends a `pageContext` object alongside the message.
4. The backend injects the page context into the AI system prompt.
5. The AI responds with information specific to the viewed entity.

**Postconditions**: The AI correctly identifies and responds about the
entity the user is currently viewing.

**Acceptance Criteria**:
- [ ] Chat widget detects entity type/id from URL patterns
- [ ] Page context is sent in the request body
- [ ] System prompt includes current page context when available
- [ ] AI can answer "this kit" / "this computer" questions correctly

## SUC-031-002: MCP Server Info

**Actor**: AI agent (Claude Code, Slack bot) querying the MCP server

**Preconditions**: MCP server is running and accessible.

**Main Flow**:
1. Agent calls `get_version` tool.
2. Tool returns version, name, hostname, and environment.
3. Agent uses this info to answer questions about the deployment.

**Postconditions**: Agent can report the server hostname and environment.

**Acceptance Criteria**:
- [ ] `get_version` returns `hostname` field (from `os.hostname()`)
- [ ] `get_version` returns `environment` field (from `NODE_ENV`)
- [ ] Tool description mentions hostname for discoverability
