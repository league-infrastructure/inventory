---
id: "004"
title: "Role-based middleware and route protection"
status: todo
use-cases: []
depends-on: ["002"]
---

# Role-based middleware and route protection

## Description

Create middleware functions for role-based route protection:
- `requireAuth` — requires any authenticated Google OAuth user
- `requireQuartermaster` — requires authenticated user with QUARTERMASTER role
- The existing `requireAdmin` middleware (fixed password) remains unchanged.

Wire up route groups so that future inventory routes can be easily protected.

## Acceptance Criteria

- [ ] `requireAuth` middleware returns 401 if no authenticated user in session
- [ ] `requireQuartermaster` middleware returns 401 if not authenticated, 403 if authenticated but not QUARTERMASTER
- [ ] Both middleware functions attach the user object to `req.user` (typed)
- [ ] TypeScript types for `req.user` are properly extended (Express.User interface)
- [ ] Existing `requireAdmin` middleware is unchanged
- [ ] Route mounting structure is prepared for inventory routes (e.g., `/api/sites`, `/api/kits`, etc.)

## Testing

- **Existing tests to run**: `cd server && npm test`
- **New tests to write**: Middleware unit tests (no session → 401, wrong role → 403, correct role → next), TypeScript compilation check
- **Verification command**: `cd server && npm test`
