---
id: '006'
title: MCP Kit Category Fix and Audit Fields
status: done
use-cases:
- SUC-005
depends-on: []
---

# MCP Kit Category Fix and Audit Fields

## Description

Investigate and fix the MCP `update_kit` tool's unreliable category updates.
Add missing audit fields for `categoryId` and `custodianId` in KitService.

### Investigation

1. Read `zIdParam()` implementation — verify it correctly coerces string
   IDs to numbers (the MCP client may send `"3"` instead of `3`).
2. Check if the `update_kit` tool description mentions categoryId and how
   to find valid values. If the AI doesn't know which IDs are valid, it
   may guess wrong.
3. Verify the service layer actually persists categoryId when passed.

### Fixes

1. **Audit fields**: Add `'categoryId'` and `'custodianId'` to the
   `auditFields` array in `server/src/services/kit.service.ts` (line 9).
   Both are currently missing — category and custodian changes are not
   audited.

2. **MCP tool description**: Update the `update_kit` tool description in
   `server/src/mcp/tools.ts` to clarify that `categoryId` expects a
   database ID (number) and suggest using `list_kits` or a category
   listing tool to find valid IDs first.

3. **zIdParam() fix** (if needed): If the coercion is incorrect, fix it.
   The function should accept number, null, string-number ("3" → 3), and
   the literal string "null" → null.

## Acceptance Criteria

- [ ] `update_kit` with valid numeric categoryId persists the change
- [ ] `update_kit` with null categoryId clears the category
- [ ] `update_kit` with string categoryId ("3") correctly coerces to number
- [ ] `categoryId` added to KitService auditFields
- [ ] `custodianId` added to KitService auditFields
- [ ] Category and custodian changes now appear in audit log
- [ ] MCP tool description clarifies categoryId expectations

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: Test update_kit with categoryId as number, string,
  null. Test audit log captures categoryId and custodianId changes.
- **Verification command**: `npm run test:server`
