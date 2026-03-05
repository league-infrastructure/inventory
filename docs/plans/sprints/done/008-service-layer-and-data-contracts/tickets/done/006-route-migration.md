---
id: '006'
title: Route migration — all routes to use service layer
status: done
use-cases:
  - SUC-001
depends-on:
  - '003'
  - '004'
  - '005'
---

# Route migration — all routes to use service layer

## Description

Rewrite all business route handlers to be thin HTTP adapters that
delegate to the service layer. Each handler follows the pattern:
parse request → call service → return result → pass errors to `next()`.

### Routes migrated

| Route file | Endpoints | Service used |
|-----------|-----------|-------------|
| `routes/sites.ts` | GET /sites, GET /sites/:id, POST /sites, PUT /sites/:id, PATCH /sites/:id/deactivate, POST /sites/nearest | siteService |
| `routes/computers.ts` | GET /computers, GET /computers/:id, POST /computers, PUT /computers/:id, PATCH /computers/:id/disposition | computerService |
| `routes/hostnames.ts` | GET /hostnames, POST /hostnames, DELETE /hostnames/:id | hostNameService |
| `routes/kits.ts` | GET /kits, GET /kits/:id, POST /kits, PUT /kits/:id, PATCH /kits/:id/retire, POST /kits/:id/clone | kitService |
| `routes/packs.ts` | GET /kits/:kitId/packs, GET /packs/:id, POST /kits/:kitId/packs, PUT /packs/:id, DELETE /packs/:id | packService |
| `routes/items.ts` | GET /packs/:packId/items, POST /packs/:packId/items, PUT /items/:id, DELETE /items/:id | itemService |
| `routes/checkouts.ts` | POST /checkouts, PATCH /checkouts/:id/checkin, GET /checkouts, GET /kits/:kitId/checkouts | checkoutService |
| `routes/qr.ts` | GET /qr/k/:id, GET /qr/c/:id, GET /qr/p/:id | qrService |

### Pattern applied

```typescript
router.get('/endpoint', requireAuth, async (req, res, next) => {
  try {
    res.json(await service.operation(req.params.id));
  } catch (err) { next(err); }
});
```

Routes no longer import Prisma or contain business logic. Auth
middleware remains on routes. The error handler middleware converts
ServiceError instances to appropriate HTTP responses.

## Acceptance Criteria

- [x] All 8 route files migrated to service layer pattern
- [x] No Prisma imports in any route file
- [x] No business logic in route handlers (validation, orchestration moved to services)
- [x] All routes use try/catch with `next(err)` for error propagation
- [x] Auth middleware (`requireAuth`, `requireQuartermaster`) preserved on all routes
- [x] API responses unchanged (same JSON shapes as before migration)

## Testing

- **Existing tests to run**: `npm run test:server` — all API tests must pass unchanged
- **Verification command**: `grep -r "from.*prisma" server/src/routes/` should return no matches for `@prisma/client` or direct Prisma imports
