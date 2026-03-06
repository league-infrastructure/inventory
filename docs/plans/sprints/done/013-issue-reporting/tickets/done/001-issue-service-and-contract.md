---
id: '001'
title: Issue Service and Contract
status: done
use-cases:
- SUC-013-001
- SUC-013-002
- SUC-013-003
depends-on: []
---

# Issue Service and Contract

## Acceptance Criteria

- [x] IssueRecord, CreateIssueInput, ResolveIssueInput contracts created
- [x] IssueService with create, list, get, resolve methods
- [x] Validates issue type (MISSING_ITEM, REPLENISHMENT)
- [x] Validates item belongs to specified pack
- [x] Registered in ServiceRegistry
- [x] Audit log entries on create and resolve
