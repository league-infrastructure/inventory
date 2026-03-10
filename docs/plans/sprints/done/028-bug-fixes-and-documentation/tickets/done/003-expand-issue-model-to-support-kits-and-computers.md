---
id: "003"
title: "Expand Issue model to support kits and computers"
status: done
use-cases: []
depends-on: []
---

# Expand Issue model to support kits and computers

## Description

Issues currently require `packId` + `itemId`, limiting them to items
within packs. Expand the model so issues can be created on kits and
computers directly.

### Schema changes

- Make `packId` and `itemId` optional on the Issue model
- Add optional `kitId` (Int?) and `computerId` (Int?) with relations
- Add `IssueType` values: `DAMAGE`, `MAINTENANCE`, `OTHER`
- Add a check constraint or service validation: at least one of
  packId/kitId/computerId must be set

### Service changes

- Update `IssueService.create()` validation to accept kitId or
  computerId instead of requiring packId + itemId
- Update `IssueService.list()` filters to support kitId, computerId
- Update contracts (CreateIssueInput, IssueRecord) for new fields

### Route changes

- Update issue routes to pass through new fields

## Acceptance Criteria

- [x] Issue can be created on a pack/item (existing behavior preserved)
- [x] Issue can be created on a kit (kitId only)
- [x] Issue can be created on a computer (computerId only)
- [x] IssueType includes DAMAGE, MAINTENANCE, OTHER
- [x] At least one target entity required (validation error if none)
- [x] List endpoint filters by kitId, computerId
- [x] Migration created

## Testing

- **Existing tests to run**: `npm run test:server`
- **Verification command**: `npm run test:server`
