---
status: draft
from-architecture-version: null
to-architecture-version: null
---

# Sprint 010 Technical Plan

## Architecture Version

- **From version**: Post-sprint-009 (service layer OO refactor)
- **To version**: Adds MCP server layer and token auth

## Architecture Overview

This sprint adds two new subsystems that sit alongside the existing
Express REST API:

```
External AI Client ──► /api/mcp (Streamable HTTP) ──► MCP Server
                           │                              │
                     Bearer Token Auth             MCP Tool Handlers
                           │                              │
                     Token Middleware ──► User Identity ──► ServiceRegistry
                                                              │
                                                         Same services
                                                         used by REST API
```

The MCP server reuses the existing `ServiceRegistry` and service classes,
ensuring that all validation, business logic, and audit logging is
identical whether changes come from the REST API or an MCP tool call.

A new `ApiToken` Prisma model stores hashed tokens linked to users.
Token authentication is a new middleware path separate from session auth,
used only for MCP endpoints.

## Component Design

### Component: ApiToken Model

**Use Cases**: SUC-001, SUC-002

New Prisma model for personal API tokens:

```prisma
model ApiToken {
  id          Int       @id @default(autoincrement())
  label       String
  tokenHash   String    @unique
  prefix      String    // First 8 chars for display
  userId      Int
  role        UserRole  // Snapshot of user's role at creation
  lastUsedAt  DateTime?
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

- `tokenHash`: SHA-256 hash of the full token. Lookup by hashing the
  incoming Bearer token and querying by hash.
- `prefix`: First 8 characters stored in plaintext for display in the UI.
- `role`: Captured at creation time — if a user's role changes, existing
  tokens retain the old role until revoked and recreated.
- `revokedAt`: Non-null means the token is revoked (soft delete).

### Component: TokenService

**Use Cases**: SUC-001, SUC-002

New service class `server/src/services/token.service.ts`:

- `create(userId, label)` → generates 32-byte random hex token, stores
  SHA-256 hash, returns `{ id, label, prefix, token }` (plaintext token
  returned only on create).
- `list(userId)` → returns all non-revoked tokens for user (without hash).
- `revoke(id, userId)` → sets `revokedAt` timestamp.
- `validate(rawToken)` → hashes token, looks up by hash, checks not
  revoked, updates `lastUsedAt`, returns `{ userId, role }` or throws.

### Component: Token Auth Middleware

**Use Cases**: SUC-003

New middleware `server/src/middleware/tokenAuth.ts`:

- Extracts `Authorization: Bearer <token>` header.
- Calls `TokenService.validate(token)`.
- Sets `req.user` with the token owner's user record and role.
- Returns 401 if token is missing, invalid, or revoked.
- Used only on MCP routes — session auth continues for REST API routes.

### Component: Token Management Routes

**Use Cases**: SUC-001, SUC-002

New route file `server/src/routes/tokens.ts`:

- `POST /api/tokens` — create token (requires session auth).
- `GET /api/tokens` — list user's tokens (requires session auth).
- `DELETE /api/tokens/:id` — revoke token (requires session auth).

### Component: MCP Server

**Use Cases**: SUC-003, SUC-004

New file `server/src/mcp/server.ts`:

- Uses `@modelcontextprotocol/sdk` with Streamable HTTP transport.
- Mounted at `/api/mcp` via Express middleware.
- Token auth middleware runs before the MCP handler.
- MCP server instance created per request with the authenticated user's
  `ServiceRegistry`.

MCP tools are thin wrappers around service methods:

| MCP Tool | Service Call | Role Required |
|----------|-------------|---------------|
| `list_sites` | `services.sites.list()` | Any |
| `get_site` | `services.sites.get(id)` | Any |
| `create_site` | `services.sites.create(input, userId)` | QM |
| `update_site` | `services.sites.update(id, input, userId)` | QM |
| `list_kits` | `services.kits.list()` | Any |
| `get_kit` | `services.kits.get(id)` | Any |
| `create_kit` | `services.kits.create(input, userId)` | QM |
| `update_kit` | `services.kits.update(id, input, userId)` | QM |
| `list_packs` | `services.packs.list(kitId)` | Any |
| `create_pack` | `services.packs.create(input, userId, kitId)` | QM |
| `update_pack` | `services.packs.update(id, input, userId)` | QM |
| `delete_pack` | `services.packs.delete(id, userId)` | QM |
| `list_items` | `services.items.list(packId)` | Any |
| `create_item` | `services.items.create(input, userId, packId)` | QM |
| `update_item` | `services.items.update(id, input, userId)` | QM |
| `delete_item` | `services.items.delete(id, userId)` | QM |
| `list_computers` | `services.computers.list()` | Any |
| `get_computer` | `services.computers.get(id)` | Any |
| `create_computer` | `services.computers.create(input, userId)` | QM |
| `update_computer` | `services.computers.update(id, input, userId)` | QM |
| `list_hostnames` | `services.hostNames.list()` | Any |
| `checkout_kit` | `services.checkouts.checkOut(input, userId)` | Any |
| `checkin_kit` | `services.checkouts.checkIn(id, input, userId)` | Any |

### Component: MCP Tool Handlers

**Use Cases**: SUC-003, SUC-004

New file `server/src/mcp/tools.ts`:

- Each tool is registered with the MCP server with a JSON Schema for its
  input parameters.
- Tool handlers extract parameters, call the service method, and return
  the result as JSON.
- Permission checks happen via a `requireRole` wrapper that checks the
  authenticated user's role before calling the service.
- Service errors (`NotFoundError`, `ValidationError`) are caught and
  returned as MCP tool errors.

### Component: Audit Source Extension

**Use Cases**: SUC-005

- Add `MCP` to the `AuditSource` enum in `schema.prisma`.
- Extend the `AuditService.write()` method to accept an optional `source`
  parameter (defaults to `'UI'`).
- MCP tool handlers pass `source: 'MCP'` when calling services that write
  audit entries.
- The `BaseService` audit methods accept an optional source override.

### Component: Token Management UI

**Use Cases**: SUC-001, SUC-002

New page `client/src/pages/settings/ApiTokens.tsx`:

- Table of existing tokens (label, prefix, created, last used).
- "Create Token" button opens a form with label input.
- On creation, shows the full token in a copyable field with a warning
  that it won't be shown again.
- "Revoke" button with confirmation on each token row.
- Accessible from sidebar under Settings.

## Open Questions

1. **MCP SDK version**: Should we use `@modelcontextprotocol/sdk` v1.x
   (stable SSE transport) or the newer streamable HTTP transport? The
   sprint document says Streamable HTTP — confirm this is correct and
   that the SDK supports it.

2. **Token role snapshot vs live lookup**: The plan stores the user's role
   at token creation time. Should we instead look up the user's current
   role on each request? Trade-off: snapshot is simpler and more
   predictable; live lookup means role changes take effect immediately
   but could surprise users.

3. **MCP tool granularity**: Should we expose every service method as a
   separate tool, or group related operations? For example, a single
   `manage_kit` tool that accepts an action parameter vs separate
   `create_kit`, `update_kit`, `get_kit` tools. Separate tools are more
   MCP-idiomatic and clearer for AI models.
