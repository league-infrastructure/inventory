---
status: approved
---

# Sprint 011 Use Cases

## SUC-011-001: Chat with AI about inventory
Parent: UC-N/A

- **Actor**: Authenticated user (Instructor or Quartermaster)
- **Preconditions**: User is logged in; AI model API key is configured
- **Main Flow**:
  1. User clicks the AI chat button in the sidebar.
  2. A chat modal opens with a text input and empty message history.
  3. User types a natural language message (e.g., "What kits are at
     Carmel Valley?").
  4. The message is sent to the server, which proxies it to the
     configured AI model along with MCP tool definitions.
  5. The AI model processes the message, optionally calling MCP tools
     to read or modify inventory data.
  6. The AI response streams back to the chat modal.
  7. The user sees the response and can continue the conversation.
- **Postconditions**: Conversation history is maintained within the
  session. Any inventory changes are audit-logged.
- **Acceptance Criteria**:
  - [ ] Chat button visible in sidebar for authenticated users
  - [ ] Chat modal opens and closes correctly
  - [ ] User can send messages and receive AI responses
  - [ ] Conversation history persists within the session
  - [ ] AI can read inventory data via MCP tools
  - [ ] AI can modify inventory data via MCP tools (Quartermaster only)

## SUC-011-002: AI executes inventory operations
Parent: UC-N/A

- **Actor**: Quartermaster
- **Preconditions**: User is logged in as Quartermaster; AI is configured
- **Main Flow**:
  1. Quartermaster opens AI chat.
  2. Types "Create a pack called Cables with 2x HDMI cables and 3x
     Ethernet cables in kit 14".
  3. AI parses the request, calls create_pack and create_item MCP tools.
  4. AI responds with a summary of what was created.
  5. The new pack and items appear in the UI when the user navigates
     to kit 14.
- **Postconditions**: Pack and items exist in the database. Audit log
  records the changes with source=MCP.
- **Acceptance Criteria**:
  - [ ] AI can create packs, items, kits, and other entities
  - [ ] AI can check out and check in kits
  - [ ] Changes are audit-logged with MCP source
  - [ ] Instructor-role users cannot make write operations through AI

## SUC-011-003: Configure AI model
Parent: UC-N/A

- **Actor**: Quartermaster (admin)
- **Preconditions**: User has Quartermaster role
- **Main Flow**:
  1. Quartermaster navigates to the admin configuration page.
  2. Sets the AI provider (Anthropic Claude) and API key.
  3. Saves the configuration.
  4. The API key is stored server-side (encrypted or as env var).
- **Postconditions**: AI chat is functional with the configured model.
- **Acceptance Criteria**:
  - [ ] Admin can set AI provider and API key
  - [ ] API key is never exposed to the client
  - [ ] Configuration persists across server restarts
  - [ ] Chat gracefully handles missing or invalid configuration

## SUC-011-004: Streaming AI responses
Parent: UC-N/A

- **Actor**: Authenticated user
- **Preconditions**: AI is configured and chat is open
- **Main Flow**:
  1. User sends a message.
  2. The AI response streams back token-by-token via SSE.
  3. The chat modal displays text incrementally as it arrives.
  4. When the stream completes, the full message is finalized.
- **Postconditions**: User sees response in real-time.
- **Acceptance Criteria**:
  - [ ] Responses stream incrementally (not block-wait)
  - [ ] UI shows a loading/typing indicator while streaming
  - [ ] Partial responses are visible during streaming
  - [ ] Stream errors are handled gracefully
