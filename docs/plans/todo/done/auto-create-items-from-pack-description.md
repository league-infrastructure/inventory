---
status: done
sprint: '010'
tickets:
- 019
---
# Auto-create items from pack descriptions with fuzzy matching

## Summary

When a pack is created with a description that mentions specific items
(e.g., "5 Edison robots, first set"), the system should create
corresponding item records automatically rather than only storing the
text in the description field.

## Matching Behavior

Before creating a new item, search existing items across all packs for
similar names. If a close match is found, reuse the same item name and
type to keep the inventory consistent.

For example:
- User says "five Edison robots" → match against existing "Edison V3
  robot" → create 5x "Edison V3 robot" (COUNTED)
- User says "11 remotes" → no close match → create "Remote" (COUNTED,
  expectedQuantity: 11)

## Why This Matters

Currently, creating packs via MCP or voice only populates the pack name
and description. The actual item records that drive inventory counts and
checklist verification are never created, making the pack data incomplete.
