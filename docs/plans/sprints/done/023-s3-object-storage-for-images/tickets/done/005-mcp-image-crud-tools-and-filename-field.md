---
id: "005"
title: "MCP image CRUD tools and fileName field"
status: done
use-cases: []
depends-on: []
---

# MCP image CRUD tools and fileName field

## Description

Add a `fileName` field to the Image model for storing original upload
filenames (supports auto-matching by serial number in future work).
Create MCP tools for full image CRUD plus attach/detach to
Computers, Kits, and Packs.

## Acceptance Criteria

- [x] `fileName String?` added to Image model with migration
- [x] `ImageService` updated: `create()` and `createFromUrl()` accept optional fileName
- [x] `ImageService.list(search?)` method added for listing/searching images
- [x] `ImageService.attach()` and `detach()` methods added
- [x] `ImageService.delete()` nulls out imageId on linked objects before deleting
- [x] MCP tools added: `list_images`, `get_image`, `create_image`, `delete_image`, `attach_image`, `detach_image`
- [x] Upload route passes original filename to `create()`
- [x] `tsc --noEmit` passes cleanly

## Testing

- **Existing tests to run**: `npm run test:server` — 28/32 suites pass (4 pre-existing failures in auth/github/pike13/integrations)
- **New tests to write**: MCP tool integration tests (deferred — no existing MCP test infrastructure)
- **Verification command**: `cd server && npx tsc --noEmit`
