---
id: '005'
title: 'Manufacturer server: routes, service, and Computer service/contracts update'
status: in-progress
use-cases:
- SUC-004
depends-on:
- '004'
github-issue: ''
issue: make-manufacturer-a-first-class-entity.md
completes_issue: false
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# 005 — Manufacturer server: routes, service, and Computer service/contracts update

## Description

With the database schema in place (ticket 004), this ticket wires up the
server layer: a new `ManufacturerService`, a new `/api/manufacturers` router
mirroring `categories.ts`, registration in `ServiceRegistry` and the Express
app, and updates to `ComputerService` and the Computer contracts so that
`manufacturerId` flows through create/update/read operations.

## Acceptance Criteria

- [x] `server/src/services/manufacturer.service.ts` exists with `list()`, `create()`, `update()`, and `delete()` (soft-delete via `deletedAt`) methods. Shape mirrors `CategoryService`.
- [x] `server/src/routes/manufacturers.ts` exists with `GET /manufacturers`, `POST /manufacturers`, `PUT /manufacturers/:id`, `DELETE /manufacturers/:id` routes. GET is guarded by `requireAuth`; POST/PUT/DELETE by `requireQuartermaster`.
- [x] `ManufacturerService` is added to `ServiceRegistry` and `manufacturer.service.ts` is exported from the services index (if one exists).
- [x] The manufacturers router is mounted in the Express app at `/api/manufacturers` alongside the categories router.
- [x] `COMPUTER_INCLUDES` in `computer.service.ts` gains `mfg: { select: { id: true, name: true } }` (Prisma relation name), remapped to `manufacturer` in API responses via `toRecord()`.
- [x] `ComputerService.create()` validates `manufacturerId` (if provided, must reference a real Manufacturer row) and writes it to the DB.
- [x] `ComputerService.update()` handles `manufacturerId` in the `data` build, same pattern as `osId` / `categoryId`.
- [x] `auditFields` in `ComputerService` includes `manufacturerId`.
- [x] `ComputerRecord` in `server/src/contracts/computer.ts` gains `manufacturerId: number | null` and `manufacturer: { id: number; name: string } | null`.
- [x] `CreateComputerInput` / `UpdateComputerInput` gain `manufacturerId?: number | null`. The old `manufacturer?: string | null` field may remain for backward compat but is no longer written by `ComputerService.create()` or `update()`.
- [x] `GET /api/manufacturers` returns a JSON array of manufacturer objects. Curl returns 401 (auth wall) confirming route is registered and live.
- [x] `GET /api/computers/:id` response includes `manufacturer: { id, name }` or `null` (via `toRecord()` transform: `mfg` → `manufacturer`).

## Implementation Plan

### Approach

Create ManufacturerService and router as direct copies of the Category
equivalents, then modify ComputerService and contracts. Mount the new router.
No client changes in this ticket.

### Files to Create

- `server/src/services/manufacturer.service.ts`
- `server/src/routes/manufacturers.ts`

### Files to Modify

- `server/src/services/service.registry.ts` — add `manufacturers: ManufacturerService`
- `server/src/app.ts` (or wherever routers are mounted) — mount manufacturersRouter
- `server/src/services/computer.service.ts` — `COMPUTER_INCLUDES`, `create()`, `update()`, `auditFields`
- `server/src/contracts/computer.ts` — `ComputerRecord`, `CreateComputerInput`, `UpdateComputerInput`

### ManufacturerService Outline

```typescript
// server/src/services/manufacturer.service.ts
import { PrismaClient } from '@prisma/client';

export class ManufacturerService {
  constructor(private prisma: PrismaClient) {}

  async list() {
    return this.prisma.manufacturer.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async create(data: { name: string }, userId: number) {
    return this.prisma.manufacturer.create({ data: { name: data.name.trim() } });
  }

  async update(id: number, data: { name: string }, userId: number) {
    return this.prisma.manufacturer.update({
      where: { id },
      data: { name: data.name.trim() },
    });
  }

  async delete(id: number) {
    return this.prisma.manufacturer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
```

### Router Pattern

Mirror `server/src/routes/categories.ts` exactly, substituting `manufacturers`
for `categories` and `services.manufacturers` for `services.categories`.

### ComputerService Changes

```typescript
// Add to COMPUTER_INCLUDES:
manufacturer: { select: { id: true, name: true } },

// In create():
if (input.manufacturerId != null) {
  if (typeof input.manufacturerId !== 'number') throw new ValidationError('manufacturerId must be a number');
  const mfg = await this.prisma.manufacturer.findUnique({ where: { id: input.manufacturerId } });
  if (!mfg) throw new ValidationError('Manufacturer not found');
}
// ...
data: {
  ...
  manufacturerId: input.manufacturerId || null,
}

// In update() data build:
if (input.manufacturerId !== undefined) data.manufacturerId = input.manufacturerId;
```

### Contract Changes

```typescript
// ComputerRecord additions:
manufacturerId: number | null;
manufacturer: { id: number; name: string } | null;

// CreateComputerInput addition:
manufacturerId?: number | null;
```

### Testing Plan

1. Start dev server: `cd server && npm run dev`.
2. `curl http://localhost:3001/api/manufacturers` — expect `[]` (empty, authenticated).
3. POST a manufacturer via curl or Insomnia; verify it appears in the list.
4. Create a computer with `manufacturerId`; GET the computer and verify `manufacturer: { id, name }` in the response.
5. Verify computers with no manufacturerId return `manufacturer: null`.

### Documentation Updates

No user-facing docs. The API is self-describing.
