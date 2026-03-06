---
status: draft
---

# Sprint 010 Use Cases

## SUC-001: Create Personal API Token
Parent: UC-MCP

- **Actor**: Authenticated user (Instructor or Quartermaster)
- **Preconditions**: User is logged in
- **Main Flow**:
  1. User navigates to Settings > API Tokens page.
  2. User clicks "Create Token" and enters a label (e.g., "Claude Desktop").
  3. System generates a random token, stores the hashed value with user ID and role.
  4. System displays the plaintext token once (not retrievable after).
  5. User copies the token.
- **Postconditions**: Token exists in database, linked to user with their role.
- **Acceptance Criteria**:
  - [ ] Token is 32-byte hex string
  - [ ] Token is stored hashed (SHA-256) — plaintext never persisted
  - [ ] Token carries the user's current role at creation time
  - [ ] Token is shown only once on creation

## SUC-002: List and Revoke API Tokens
Parent: UC-MCP

- **Actor**: Authenticated user
- **Preconditions**: User has at least one API token
- **Main Flow**:
  1. User navigates to Settings > API Tokens page.
  2. System lists tokens: label, creation date, last used date, truncated prefix.
  3. User clicks "Revoke" on a token.
  4. System marks the token as revoked (soft delete).
- **Postconditions**: Revoked token can no longer authenticate.
- **Acceptance Criteria**:
  - [ ] Token list shows label, created date, last used, and first 8 chars
  - [ ] Revoked tokens are immediately rejected on next use
  - [ ] Revoked tokens are hidden from the active list

## SUC-003: External MCP Client Connects with Token
Parent: UC-MCP

- **Actor**: External AI model (Claude, OpenAI, etc.) via MCP client
- **Preconditions**: User has a valid API token; MCP server is running
- **Main Flow**:
  1. External client sends HTTP request to `/api/mcp` with `Authorization: Bearer <token>`.
  2. Server validates the token (hash lookup), resolves the owning user.
  3. MCP session is established with the user's identity and role.
  4. Client calls `tools/list` — server returns available tools based on role.
  5. Client calls a tool (e.g., `create_pack`) with parameters.
  6. Server executes the operation through the service layer using the token owner's identity.
  7. Result is returned to the client.
- **Postconditions**: Changes are persisted; audit log records the change with MCP source.
- **Acceptance Criteria**:
  - [ ] Valid token authenticates and resolves user identity
  - [ ] Invalid/revoked token returns 401
  - [ ] Instructor tokens cannot access Quartermaster-only tools
  - [ ] All tool calls go through the existing service layer

## SUC-004: MCP Tool Calls Respect Role Permissions
Parent: UC-MCP

- **Actor**: External AI model
- **Preconditions**: Token is valid
- **Main Flow**:
  1. Instructor-role token calls a write tool (e.g., `create_kit`).
  2. Server checks the token owner's role.
  3. If the tool requires Quartermaster, server returns a permission error.
  4. Read-only tools and Instructor-allowed tools succeed.
- **Postconditions**: Permission boundary is enforced.
- **Acceptance Criteria**:
  - [ ] Write operations (create/update/delete) require Quartermaster role
  - [ ] Read operations and checkouts work for Instructor role
  - [ ] Permission errors return clear error messages

## SUC-005: AI-Initiated Changes Appear in Audit Log
Parent: UC-MCP

- **Actor**: System (automatic)
- **Preconditions**: An MCP tool call modifies data
- **Main Flow**:
  1. MCP tool handler calls service layer with `source: 'MCP'`.
  2. Service layer writes audit log entries with `source = 'MCP'`.
  3. User views audit log — MCP-initiated entries are visually distinct.
- **Postconditions**: Audit trail clearly distinguishes MCP vs human changes.
- **Acceptance Criteria**:
  - [ ] Audit log entries from MCP tools have `source = 'MCP'`
  - [ ] AuditSource enum extended with MCP value
