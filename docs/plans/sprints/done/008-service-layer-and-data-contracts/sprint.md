---
id: 008
title: Service Layer and Data Contracts
status: done
branch: sprint/008-service-layer-and-data-contracts
use-cases: []
---

# Sprint 008: Service Layer and Data Contracts

## Goals

Introduce a service layer that becomes the single gateway to all
database operations and business logic. Define canonical JSON data
contracts (TypeScript interfaces) for every domain object. Migrate
all existing route handlers to delegate to the service layer. Build a
round-trip test harness that imports test data through the service
layer, exports it, and verifies correctness.

## Problem

Today, application logic and database access are scattered across
route handlers. Each route directly calls Prisma, applies validation,
performs orchestration (e.g., linking a host name to a computer), and
constructs response objects — all inline. This creates several
problems:

1. **Duplication** — the same logic will need to be reimplemented in
   the MCP server (Sprint 009), import/export (Sprint 014), and any
   future integration point.
2. **Inconsistency** — different routes return slightly different
   shapes for the same entities.
3. **Testability** — testing business logic requires HTTP round-trips
   through Supertest; there's no way to test service logic directly.
4. **AI integration risk** — the MCP server and AI chat (Sprints 009,
   010) need a clean API surface they can call; raw Prisma calls are
   too low-level and lack business rules.

## Solution

### Service Layer (`server/src/services/`)

Create service modules for each domain:

| Service | Responsibilities |
|---------|-----------------|
| `siteService` | CRUD sites, deactivate |
| `computerService` | CRUD computers, disposition changes, host name assignment |
| `hostNameService` | CRUD host names |
| `kitService` | CRUD kits, clone, retire |
| `packService` | CRUD packs, manage items |
| `userService` | User lookup, role checks |
| `qrService` | QR code generation and lookup |
| `auditService` | Write audit entries (wraps existing auditLog) |

Rules:
- **No Prisma calls above the service layer.** Routes, MCP tools,
  import/export, and the AI chat all call service functions.
- **No HTTP/Express concerns in the service layer.** Services accept
  plain objects and return plain objects. They throw typed errors that
  routes translate to HTTP status codes.
- **All orchestration lives in services.** Multi-step operations
  (e.g., clone a kit with its packs and items) are single service
  function calls.

### Data Contracts (`server/src/contracts/`)

Define TypeScript interfaces for every domain object's JSON
representation:

```
contracts/
  site.ts        — SiteRecord, CreateSiteInput, UpdateSiteInput
  computer.ts    — ComputerRecord, CreateComputerInput, UpdateComputerInput
  hostName.ts    — HostNameRecord, CreateHostNameInput
  kit.ts         — KitRecord, KitDetailRecord, CreateKitInput, UpdateKitInput
  pack.ts        — PackRecord, CreatePackInput
  item.ts        — ItemRecord, CreateItemInput
  user.ts        — UserRecord
  index.ts       — Re-exports all contracts
```

These interfaces define exactly what goes over the wire. Service
functions return these types. The contracts document describes the
canonical JSON shape of each object.

### Route Migration

Every route handler is rewritten to:
1. Parse and validate HTTP inputs (params, body, query).
2. Call the appropriate service function.
3. Return the result (which is already a contract type).
4. Catch service errors and map to HTTP status codes.

### Test Harness

Build a round-trip integration test:
1. **Test data file** (`tests/fixtures/inventory-seed.json`) — a JSON
   file containing sites, host names, computers, kits, packs, and
   items in the contract format.
2. **Import script** — uses the service layer to reset the database
   and load everything from the fixture file.
3. **Export function** — uses the service layer to read all data back
   out in the same JSON format.
4. **Verification** — compares the exported data to the original
   fixture, field by field, to ensure nothing was lost or mutated.

### Instruction Updates

Add documentation to `AGENTS.md` and `docs/template-spec.md`
establishing the service layer as a mandatory architectural rule:

> All database access and business logic MUST go through the service
> layer. Route handlers, MCP tools, import/export, and the AI chat
> interface are consumers of the service layer — they MUST NOT call
> Prisma directly or contain business logic.

## Success Criteria

- Every existing route handler delegates to a service function.
- No Prisma calls exist outside `server/src/services/`.
- Data contract interfaces are defined for all domain objects.
- Service functions return contract types, not raw Prisma models.
- The round-trip test (import → export → compare) passes with the
  fixture data.
- All existing API tests still pass.
- `AGENTS.md` documents the service layer rule.
- A contracts reference document exists at `docs/contracts.md`.

## Scope

### In Scope

- Service modules for all domain entities
- Data contract TypeScript interfaces
- Route handler migration (all existing routes)
- Service-layer error types (NotFound, ValidationError, etc.)
- Round-trip integration test harness
- Test fixture data (JSON seed file)
- Documentation updates (AGENTS.md, docs/contracts.md)
- Audit service wrapping existing audit log functions

### Out of Scope

- New features or API endpoints (just restructuring)
- Frontend changes (routes return the same JSON shapes)
- Checkout/check-in service (Sprint 007 — but the service layer
  pattern will be established for it to follow)
- MCP server (Sprint 009 — will consume the service layer)

## Test Strategy

- **Round-trip test**: Load fixture → export → deep compare. This is
  the primary validation that the service layer works correctly.
- **Service unit tests**: Direct calls to service functions, verifying
  return types match contracts, error cases throw correctly.
- **Existing API tests**: Must continue to pass — validates that the
  route migration didn't break anything.
- **No-Prisma lint check**: Grep for Prisma imports outside
  `services/` to enforce the architectural rule.

## Architecture Notes

- Service functions are stateless — they receive a Prisma client
  (or use the singleton) and operate on it. This makes them testable
  with a test database.
- Error types: `ServiceError` base class with subclasses `NotFound`,
  `ValidationError`, `ConflictError`. Routes catch these and map to
  404, 400, 409 respectively.
- The audit log integration moves into services: each mutation service
  function writes audit entries as part of its operation.
- Contract types are separate from Prisma-generated types. Services
  map Prisma results to contract objects, decoupling the API surface
  from the database schema.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
