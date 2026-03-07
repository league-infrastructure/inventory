---
status: pending
---

# Require minimum fields when creating computers

Currently `create_computer` accepts zero identifying fields — no
`serialNumber`, no `serviceTag`, no `model` — producing empty computer
records with only auto-generated IDs.

## Problem

An MCP client or API consumer can create a computer with no useful data:

```
create_computer({ siteId: 1 })
```

This creates a record that cannot be distinguished from other empty
records and has no practical value in the inventory.

## Proposed fix

Add validation in `ComputerService.create()` requiring at least one of:

- `serialNumber`
- `serviceTag`
- `model`

Return a `ValidationError` if none are provided:
`"At least one identifying field (serialNumber, serviceTag, or model) is required."`
