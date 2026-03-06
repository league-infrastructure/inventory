---
id: "019"
title: "Auto-create items from pack descriptions with fuzzy matching"
status: todo
use-cases: []
depends-on: []
---

# Auto-create items from pack descriptions with fuzzy matching

## Description

When a pack is created with a description mentioning specific items
(e.g., "5 Edison robots"), the system should create corresponding item
records rather than only storing text in the description. Before creating
a new item, search existing items for similar names and reuse matching
names/types for consistency.

## Examples

- "five Edison robots" → match existing "Edison V3 robot" → create 5x
  "Edison V3 robot" (COUNTED)
- "11 remotes" → no match → create "Remote" (COUNTED, qty 11)

## Acceptance Criteria

- [ ] Pack creation parses description for item mentions
- [ ] Fuzzy matching against existing item names across all packs
- [ ] Close matches reuse existing item name and type
- [ ] New items created with appropriate type (COUNTED/CONSUMABLE) and quantity
- [ ] Items created as actual item records, not just description text

## Testing

- **Existing tests to run**: `npm run test:server`
- **New tests to write**: Description parsing, fuzzy matching, item creation
- **Verification command**: `npm run test:server`
