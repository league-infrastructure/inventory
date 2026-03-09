---
status: done
sprint: '025'
tickets:
- '022'
---

# Searching for a number should find by kit number

When a user searches for a number (e.g. "16") in the inventory system,
it should match against kit numbers first. Currently the SearchService
only searches by name, description, model, serialNumber, serviceTag,
and hostname — it does not search by kit number.

## Where this matters

- The `/inventory` slash command already handles this with a special
  `parseInt` check before falling back to search, but the general
  SearchService used by the web UI and AI chat does not.
- A user typing "16" in the search bar should see Kit #16 in results.

## Fix

Update `server/src/services/search.service.ts` to include kit number
matching when the query is numeric:

```typescript
if (!isNaN(parseInt(query, 10))) {
  // Also search kits by number
  const kitByNumber = await this.prisma.kit.findFirst({
    where: { number: parseInt(query, 10) },
  });
  if (kitByNumber) { /* add to results */ }
}
```
