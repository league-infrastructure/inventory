---
id: "003"
title: "Add issue tools to AI chat service"
status: todo
use-cases: []
depends-on: []
---

# Add issue tools to AI chat service

## Description

The MCP server has `list_issues`, `create_issue`, and `resolve_issue`
tools, but the AI chat service (`ai-chat.service.ts`) does not expose
them. The web and Slack AI chat bots tell users they can't manage issues.

### Changes needed

- **`ai-chat.service.ts`**: Add tool definitions for `list_issues`,
  `create_issue`, and `resolve_issue` in `getToolDefinitions()`. Add
  corresponding `case` handlers in `executeTool()` that call the
  issue service.
- **`ai-chat-system.txt`**: Update the system prompt to mention issue
  management capabilities.

## Acceptance Criteria

- [ ] AI chat can list issues (with optional filters)
- [ ] AI chat can create issues on kits, packs, and computers
- [ ] AI chat can resolve issues
- [ ] System prompt mentions issue management
- [ ] Tools respect role-based access (QM+ for create/resolve)

## Testing

- **Existing tests to run**: `npm run test:server`
- **Verification command**: Test via web AI chat and Slack
