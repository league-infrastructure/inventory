---
id: '008'
title: Documentation — AGENTS.md and contracts reference
status: done
use-cases:
  - SUC-004
depends-on:
  - '002'
  - '006'
---

# Documentation — AGENTS.md and contracts reference

## Description

Update project documentation to establish the service layer as a
mandatory architectural rule and document all data contract types for
reference by developers and AI agents.

### Changes made

**AGENTS.md** — added "Architecture Rules > Service Layer" section:

- All database access and business logic MUST go through the service layer
- Route handlers must be thin HTTP adapters (parse → call service → return → error)
- Service functions accept contract input types and return contract record types
- Error handler maps ServiceError subclasses to HTTP status codes

**docs/contracts.md** — new file documenting all contract types:

- SiteRecord, CreateSiteInput, UpdateSiteInput, NearestSiteResult
- ComputerRecord, CreateComputerInput, UpdateComputerInput
- HostNameRecord, CreateHostNameInput
- KitRecord, KitDetailRecord, CreateKitInput, UpdateKitInput
- PackRecord, PackDetailRecord, CreatePackInput, UpdatePackInput
- ItemRecord, CreateItemInput, UpdateItemInput
- CheckoutRecord, CreateCheckoutInput, CheckinInput
- UserRecord

Each type is documented with its full TypeScript interface showing all
fields and their types, serving as the canonical wire format reference.

## Acceptance Criteria

- [x] AGENTS.md documents "no Prisma above service layer" architectural rule
- [x] AGENTS.md documents thin route handler pattern
- [x] AGENTS.md documents ServiceError → HTTP status code mapping
- [x] docs/contracts.md exists with all domain entity contract types
- [x] Contract docs match the actual TypeScript interfaces in server/src/contracts/

## Testing

- **Verification**: Review AGENTS.md and docs/contracts.md for accuracy against implementation
