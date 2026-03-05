---
id: '002'
title: Data contract interfaces
status: done
use-cases:
  - SUC-002
depends-on: []
---

# Data contract interfaces

## Description

Define TypeScript interfaces in `server/src/contracts/` for every domain
entity's JSON wire format. These types establish the canonical shapes
for API responses and service function return values, decoupling the
API surface from the Prisma-generated database types.

### Files created

| File | Types defined |
|------|--------------|
| `contracts/site.ts` | `SiteRecord`, `CreateSiteInput`, `UpdateSiteInput`, `NearestSiteResult` |
| `contracts/computer.ts` | `ComputerRecord`, `CreateComputerInput`, `UpdateComputerInput` |
| `contracts/hostName.ts` | `HostNameRecord`, `CreateHostNameInput` |
| `contracts/kit.ts` | `KitRecord`, `KitDetailRecord`, `CreateKitInput`, `UpdateKitInput` |
| `contracts/pack.ts` | `PackRecord`, `PackDetailRecord`, `CreatePackInput`, `UpdatePackInput` |
| `contracts/item.ts` | `ItemRecord`, `CreateItemInput`, `UpdateItemInput` |
| `contracts/checkout.ts` | `CheckoutRecord`, `CreateCheckoutInput`, `CheckinInput` |
| `contracts/user.ts` | `UserRecord` |
| `contracts/index.ts` | Re-exports all types |

### Design decisions

- Record types include related entity summaries (e.g., `ComputerRecord`
  includes `site: { id, name }` and `hostName: { id, name, computerId }`)
- Date fields are typed as `string` (ISO 8601) since JSON serialization
  converts `Date` objects to strings
- `KitDetailRecord` extends `KitRecord` with nested `packs` and
  `computers` arrays for the detail view
- Input types use optional fields with `?` for partial updates

## Acceptance Criteria

- [x] Contract interfaces defined for all 8 domain entities
- [x] Record types, create input types, and update input types for each entity
- [x] `contracts/index.ts` re-exports all types
- [x] Related entity summaries included in record types (site, hostName, kit references)
- [x] Date fields typed as `string` for JSON wire format

## Testing

- **Verification**: TypeScript compilation succeeds with service functions typed to return contract types
