---
status: approved
---

# Sprint 010 Use Cases

## SUC-001: Generate MCP Configuration from Account Page
Parent: UC-MCP

- **Actor**: Authenticated user (Instructor or Quartermaster)
- **Preconditions**: User is logged in
- **Main Flow**:
  1. User navigates to their Account page.
  2. If no token exists, system shows a "Generate Token" button.
  3. User clicks the button.
  4. System generates a random token, stores the hashed value with user
     ID and role.
  5. System displays the MCP configuration snippet (JSON) with the
     server URL and the user's token embedded.
  6. User clicks "Copy" to copy the full snippet to clipboard.
  7. User pastes the snippet into their AI client configuration.
- **Postconditions**: Token exists in database; user has a ready-to-paste
  config snippet.
- **Acceptance Criteria**:
  - [ ] Token is 32-byte hex string
  - [ ] Token is stored hashed (SHA-256) — plaintext never persisted
  - [ ] Token carries the user's current role at creation time
  - [ ] Config snippet includes server URL and Bearer token
  - [ ] Copy button copies the full JSON snippet

## SUC-002: Regenerate Token
Parent: UC-MCP

- **Actor**: Authenticated user
- **Preconditions**: User has an existing API token
- **Main Flow**:
  1. User navigates to their Account page and sees the MCP config snippet.
  2. User clicks "Regenerate Token".
  3. System confirms: "This will disconnect any clients using the current
     token."
  4. User confirms.
  5. System revokes the old token and generates a new one.
  6. System rebuilds the config snippet with the new token.
- **Postconditions**: Old token is revoked; new token is active; snippet
  is updated.
- **Acceptance Criteria**:
  - [ ] Old token is immediately revoked (rejected on next use)
  - [ ] New token is generated and displayed in the snippet
  - [ ] Confirmation prompt before regenerating

## SUC-003: External MCP Client Connects with Token
Parent: UC-MCP

- **Actor**: External AI model (Claude, OpenAI, etc.) via MCP client
- **Preconditions**: User has a valid API token; MCP server is running
- **Main Flow**:
  1. External client sends HTTP request to `/api/mcp` with
     `Authorization: Bearer <token>`.
  2. Server validates the token (hash lookup), resolves the owning user.
  3. MCP session is established with the user's identity and role.
  4. Client calls `tools/list` — server returns available tools based on
     role.
  5. Client calls a tool (e.g., `create_pack`) with parameters.
  6. Server executes the operation through the service layer using the
     token owner's identity.
  7. Result is returned to the client.
- **Postconditions**: Changes are persisted; audit log records the change
  with MCP source.
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
- **Postconditions**: Audit trail clearly distinguishes MCP vs human
  changes.
- **Acceptance Criteria**:
  - [ ] Audit log entries from MCP tools have `source = 'MCP'`
  - [ ] AuditSource enum extended with MCP value

## SUC-006: Admin Views and Revokes Tokens
Parent: UC-MCP

- **Actor**: Quartermaster (admin)
- **Preconditions**: User is logged in with Quartermaster role
- **Main Flow**:
  1. Quartermaster navigates to the admin dashboard.
  2. System displays a list of all API tokens across all users, showing
     token prefix, owning user, role, creation date, last used date, and
     status.
  3. Quartermaster identifies a token to revoke.
  4. Quartermaster clicks "Revoke" on the token row.
  5. System confirms: "This will disconnect the user's MCP client."
  6. Quartermaster confirms.
  7. System revokes the token.
- **Postconditions**: Token is revoked; the owning user's MCP client is
  disconnected on next request.
- **Acceptance Criteria**:
  - [ ] Admin can view all tokens across all users
  - [ ] Token list shows prefix, user, role, dates, and status
  - [ ] Admin can revoke any token
  - [ ] Revoked tokens are immediately rejected
  - [ ] Only Quartermaster-role users can access admin token management
