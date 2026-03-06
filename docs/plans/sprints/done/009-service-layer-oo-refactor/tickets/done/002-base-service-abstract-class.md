---
id: '002'
title: BaseService abstract class
status: done
use-cases:
- SUC-001
depends-on:
- '001'
---

# BaseService abstract class

## Description

Create the abstract generic `BaseService<TRecord, TCreate, TUpdate>`
class that all domain services will extend. This establishes the
template method pattern for the validate → persist → audit → return
pipeline.

### File: `server/src/services/BaseService.ts`

- Generic type parameters: `TRecord`, `TCreate`, `TUpdate`
- Constructor receives `PrismaClient` and `AuditService`
- Abstract properties: `entityName`, `auditFields`
- Abstract methods: `list()`, `get()`, `create()`, `update()`
- Protected helpers: `buildAuditEntries()`, `writeAudit()`

### Design notes

- `list`, `get`, `create`, `update` are abstract because each entity
  has different Prisma queries, includes, and ordering
- `delete` is NOT abstract — only entities that support deletion
  implement it
- `buildAuditEntries()` delegates to `this.audit.diff()`
- `writeAudit()` delegates to `this.audit.write()`

## Acceptance Criteria

- [ ] `BaseService` abstract class with generic type parameters
- [ ] Constructor accepts `PrismaClient` and `AuditService`
- [ ] Abstract `entityName` and `auditFields` properties
- [ ] Abstract `list`, `get`, `create`, `update` methods
- [ ] Protected `buildAuditEntries()` and `writeAudit()` helpers
- [ ] TypeScript compiles successfully

## Testing

- **Verification**: TypeScript compilation succeeds; class is abstract and cannot be instantiated directly
