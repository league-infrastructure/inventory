---
id: '005'
title: Audit source propagation
status: todo
use-cases:
- SUC-005
depends-on:
- '001'
---

# Audit source propagation

## Description

Wire up the `MCP` audit source so that operations performed via MCP tools
are automatically tagged in the audit log without changing any service
method signatures.

### Changes

1. **AuditService**: Add a `defaultSource` constructor parameter
   (defaults to `'UI'`). All `write()` and `diff()` calls use this
   default source unless explicitly overridden.

2. **ServiceRegistry.create()**: Add an optional `source` parameter.
   When provided, it's forwarded to the `AuditService` constructor.
   The existing call in `app.ts` (for REST routes) continues to use the
   default `'UI'` source.

3. **MCP handlers** (ticket 006/007) will call
   `ServiceRegistry.create(prisma, 'MCP')` to get a registry whose audit
   entries are tagged with `source = 'MCP'`.

## Acceptance Criteria

- [ ] `AuditService` accepts `defaultSource` constructor parameter
- [ ] `AuditService` defaults to `'UI'` when no source specified
- [ ] `ServiceRegistry.create()` accepts optional `source` parameter
- [ ] Source is forwarded to `AuditService` constructor
- [ ] Existing REST API audit entries still have `source = 'UI'`
- [ ] No service method signatures changed
- [ ] All existing tests pass

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: Test that `ServiceRegistry.create(prisma, 'MCP')`
  produces audit entries with `source = 'MCP'`
- **Verification command**: `npm run test:server`
