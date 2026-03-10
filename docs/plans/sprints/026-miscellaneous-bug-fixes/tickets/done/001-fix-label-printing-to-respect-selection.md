---
id: "001"
title: "Fix label printing to respect selection"
status: done
use-cases: []
depends-on: []
---

# Fix label printing to respect selection

## Description

When printing labels from a kit page, the label selection dialog lets
users check/uncheck individual pack labels. However, the server ignored
the selection — when `packIds` was empty, it fell back to printing ALL
packs instead of none.

## Fix

In `label.service.ts`, both `generateBatchLabels()` and
`generateBatchHtml()` had:

```typescript
const selectedPacks = packIds.length > 0
  ? kit.packs.filter((p) => packIds.includes(p.id))
  : kit.packs;  // BUG: empty selection → all packs
```

Changed to always filter by the provided `packIds`:

```typescript
const selectedPacks = kit.packs.filter((p) => packIds.includes(p.id));
```

## Acceptance Criteria

- [x] Selecting specific packs prints only those packs
- [x] Selecting no packs prints no pack labels
- [x] Existing label tests pass

## Testing

- **Existing tests**: `tests/server/labels.test.ts`, `tests/server/services/label.service.test.ts` — 11 tests pass
