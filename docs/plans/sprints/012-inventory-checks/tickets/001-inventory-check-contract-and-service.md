---
id: '001'
title: Inventory Check Contract and Service
status: todo
use-cases:
- SUC-012-001
- SUC-012-002
- SUC-012-003
- SUC-012-004
depends-on: []
---

# Inventory Check Contract and Service

## Description

Create the contract types and service for inventory checks. The service
generates checklists from kit/pack contents, records submitted checks,
flags discrepancies, and provides history.

## Acceptance Criteria

- [ ] `InventoryCheckRecord` and `InventoryCheckLineRecord` contracts created
- [ ] `CreateInventoryCheckInput` and `SubmitInventoryCheckInput` contracts created
- [ ] `InventoryCheckService` class created in `server/src/services/`
- [ ] `startKitCheck(kitId, userId)` generates lines for all items and computers
- [ ] `startPackCheck(packId, userId)` generates lines for all items
- [ ] `submitCheck(checkId, lines, notes, userId)` updates lines and flags discrepancies
- [ ] `submitCheck` updates computer `lastInventoried` for present computers
- [ ] `getCheck(id)` returns check with lines
- [ ] `getHistory(kitId?, packId?)` returns past checks
- [ ] Service registered in ServiceRegistry
- [ ] Audit log entries created for check submission

## Testing

- Service test: start kit check generates correct lines
- Service test: start pack check generates correct lines
- Service test: submit check flags discrepancies
- Service test: submit check updates computer lastInventoried
- Service test: get history returns past checks
- Verify in `tests/server/services/`
