---
status: pending
---

# Expand issues to support kits and computers

## Description

The Issue model currently requires both `packId` and `itemId`, limiting
issues to items within packs. Issues should also be creatable on kits
and computers directly.

Changes needed:

- Make `packId` and `itemId` optional on the Issue model
- Add optional `kitId` and `computerId` fields
- Add relations from Kit and Computer to Issue
- Broaden `IssueType` enum beyond MISSING_ITEM and REPLENISHMENT
  (e.g., DAMAGE, MAINTENANCE, OTHER)
- Require at least one of packId/itemId/kitId/computerId
- Update IssueService validation accordingly
