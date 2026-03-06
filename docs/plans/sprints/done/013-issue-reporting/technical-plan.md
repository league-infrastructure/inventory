---
status: approved
from-architecture-version: null
to-architecture-version: null
---

# Sprint 013 Technical Plan

## Architecture Overview

Sprint 013 adds issue reporting and resolution. The Issue model already
exists in the Prisma schema. This sprint adds:

1. **Issue contracts** — TypeScript types for issues
2. **IssueService** — create, list, get, resolve issues
3. **Issue routes** — REST API endpoints
4. **Issue queue frontend** — list and resolve issues page

## Component Design

### Component 1: Issue Service and Contract

**Use Cases**: SUC-013-001, SUC-013-002, SUC-013-003

- IssueRecord, CreateIssueInput, ResolveIssueInput contracts
- IssueService with create, list, get, resolve methods
- Validates item belongs to pack, validates issue type
- Registered in ServiceRegistry

### Component 2: Issue Routes

**Use Cases**: SUC-013-001, SUC-013-002, SUC-013-003

- GET /api/issues (with status/packId/type filters)
- GET /api/issues/:id
- POST /api/issues
- PATCH /api/issues/:id/resolve
- All require authentication

### Component 3: Issue Queue Frontend

**Use Cases**: SUC-013-001, SUC-013-002, SUC-013-003

- Issues page with open/resolved filter
- Issue cards showing type, item, pack, reporter
- Resolve button with notes input
- Sidebar navigation entry
