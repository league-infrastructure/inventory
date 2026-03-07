# Bug: Raw Prisma errors exposed on unique constraint violations

**Date:** 2026-03-07
**Severity:** Low — cosmetic / DX issue, no data loss
**Found by:** MCP test plan execution

## Description

When creating a site or operating system with a duplicate name, the API
returns a raw Prisma error message including the full stack trace and
internal file paths, rather than a clean `ValidationError`.

## Affected operations

- `create_site` with duplicate name — returns raw `Unique constraint failed
  on the fields: (\`name\`)` with Prisma stack trace
- `create_operating_system` with duplicate name — same raw error, also
  exposes internal file path (`server/src/mcp/tools.ts:284:56`)

## Expected behavior

A clean validation error like:
- "Site name already exists"
- "Operating system name already exists"

Similar to how `create_kit` returns `"Kit number 900 is already in use"`
and `create_hostname` returns `"Host name already exists"`.

## Root cause

The site service (`site.service.ts`) and the OS create path in `tools.ts`
don't check for existing records before calling `prisma.create()`. The
uniqueness check happens at the database level and the Prisma error
bubbles up unhandled.

## Fix

Add a `findUnique` check before `create` in:
1. `SiteService.create()` — check for existing site by name
2. MCP `create_operating_system` tool — check for existing OS by name
   (or better, create an `OsService` with proper validation)
