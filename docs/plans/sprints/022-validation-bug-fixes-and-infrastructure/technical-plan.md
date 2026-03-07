---
status: approved
---

# Sprint 022 Technical Plan

## Architecture Version

- **From version**: no change (bug-fix sprint)
- **To version**: no change

## Component Design

### 1. ComputerService validation
File: `server/src/services/computer.service.ts`
Add check in `create()` requiring at least one of serialNumber, serviceTag, model.

### 2. SiteService home site enforcement
File: `server/src/services/site.service.ts`
In `create()` and `update()`, auto-clear isHomeSite on other sites when setting true.

### 3. OsService extraction
New file: `server/src/services/os.service.ts`
Move OS CRUD from MCP tools to proper service. Add duplicate name validation.
Update `server/src/mcp/tools.ts` to delegate to OsService.

### 4. Computer/Kit site sync
Files: `server/src/services/computer.service.ts`, `server/src/services/kit.service.ts`
- Computer assigned to kit: set computer.siteId = kit.siteId
- Kit site cascade already exists — verify coverage
- Data migration for existing mismatches

### 5. Docker pg_dump
Files: `docker/Dockerfile.server`, `docker/Dockerfile.server.dev`
Add `postgresql16-client` package.

### 6. Label layout (commit only)
Already implemented. Commit existing changes.

### 7. Test hostname cleanup
Delete TestHost-*/DupHost-* via API or direct query.
