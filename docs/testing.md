# Testing Strategy

This document defines the testing approach for the LAP Inventory
application. It covers three test layers, authentication bypass for
automated tests, and the infrastructure required for each layer.

---

## 1. Test Pyramid

| Layer | Framework | Directory | What It Tests | Auth |
|-------|-----------|-----------|---------------|------|
| **Database/Service** | Jest + Prisma | `tests/db/` | Direct DB operations, service functions, model constraints | None (direct function calls) |
| **API/HTTP** | Jest + Supertest | `tests/server/` | Express route handlers, middleware, request/response contracts | `POST /api/test/login` |
| **Client** |  Vitest + RTL | `tests/client/` | React components, user interactions, UI logic | None (isolated from server) |
| **E2E/Browser** | Playwright | `tests/e2e/` | Full user flows through the browser | `GET /api/auth/test-login?role=X` |

Client component tests (Vitest + React Testing Library) are planned but
not yet set up. See [Section 8](#8-client-component-tests-future) for
the design.

---

## 2. Running Tests

```bash
npm run test:server   # API/HTTP tests (Jest + Supertest)
npm run test:db       # Database/service tests (Jest + Prisma)
npm run test:client   # Client component tests (Vitest) — not yet set up
npm run test:e2e      # End-to-end tests (Playwright)
```

All test commands are defined in the root `package.json`.

---

## 3. Authentication Bypass

Most API routes require Google OAuth authentication (`requireAuth`,
`requireQuartermaster`). Automated tests cannot use real OAuth. Instead,
the app exposes test-only login routes when `NODE_ENV` is `test` or
`e2e`.

### 3.1 Safety Guarantees

The test auth routes are in `server/src/routes/testAuth.ts`. This module
has two layers of protection:

1. **Module-level guard**: The file throws an error at load time if
   `NODE_ENV === 'production'`. Even if somehow imported, it will crash
   rather than expose a bypass.
2. **Conditional mount**: `app.ts` only `require()`s and mounts the
   router when `NODE_ENV` is `test` or `e2e`. In production, the code
   path is never reached.

### 3.2 API Tests (Supertest)

Use `POST /api/test/login` to create an authenticated session:

```typescript
import { createAuthAgent } from './helpers/auth';

describe('Kit CRUD', () => {
  const agent = createAuthAgent('QUARTERMASTER');

  it('creates a kit', async () => {
    const res = await agent
      .post('/api/kits')
      .send({ name: 'Test Kit', siteId: 1 });
    expect(res.status).toBe(201);
  });
});
```

`createAuthAgent(role)` returns a Supertest agent that preserves cookies
across requests. It calls `POST /api/test/login` in `beforeAll` and
`POST /api/test/logout` in `afterAll`.

For admin routes, use `createAdminAgent()`.

### 3.3 E2E Tests (Playwright)

Use `GET /api/auth/test-login?role=ROLE` to create a browser session:

```typescript
import { test } from '../fixtures/auth';

test('quartermaster can create a kit', async ({ quartermasterPage }) => {
  await quartermasterPage.goto('/kits/new');
  // ... fill form and submit
});
```

The auth fixture calls the test-login endpoint via `page.request.get()`
before each test, creating a session cookie the browser uses for all
subsequent navigation.

### 3.4 Available Test Roles

| Role | Description |
|------|-------------|
| `INSTRUCTOR` | Default OAuth user. Read-only access to most resources. |
| `QUARTERMASTER` | Elevated user. Full CRUD on kits, computers, etc. |
| Admin | Separate auth. Use `createAdminAgent()` or admin login in Playwright. |

---

## 4. Database/Service Layer Tests

These tests call Prisma functions and service utilities directly,
verifying that data is correctly written, read, and constrained in
PostgreSQL.

### 4.1 Test Database

Database tests use a separate `app_test` database on the same Postgres
instance as development (port 5433). This isolates test data from
development data.

The test setup script (`tests/db/setup.ts`) automatically:
1. Creates the `app_test` database if it doesn't exist.
2. Runs `prisma migrate deploy` against it.

### 4.2 Cleanup Between Tests

Tests use table truncation to reset state between test files:

```typescript
import { truncateAll } from './helpers/truncate';

beforeEach(async () => {
  await truncateAll();
});
```

`truncateAll()` truncates every application table with `CASCADE`,
preserving the schema and sequences.

### 4.3 Test Data Factories

Use factory functions to create test data with sensible defaults:

```typescript
import { createTestUser, createTestSite, createTestKit } from './helpers/factories';

it('creates a kit linked to a site', async () => {
  const site = await createTestSite({ name: 'Test Site' });
  const kit = await createTestKit(site.id, { name: 'Alpha Kit' });
  expect(kit.siteId).toBe(site.id);
});
```

Factories generate unique values (email, googleId) using timestamps to
avoid constraint violations.

### 4.4 What to Test at This Layer

- Model constraints: unique fields, required fields, enum validation
- Service functions: `writeAuditLog()`, `diffForAudit()`, QR generation
- Cascade behavior: deleting a Kit cascades to Packs and Items
- Complex queries: filtering, includes, ordering

### 4.5 Configuration

- Jest config: `tests/db/jest.config.js`
- TypeScript config: `tests/db/tsconfig.json`
- Global setup: `tests/db/setup.ts`
- Global teardown: `tests/db/teardown.ts`

---

## 5. API/HTTP Layer Tests

These tests call Express endpoints via Supertest, verifying route
handlers, middleware, status codes, and response shapes.

### 5.1 Existing Patterns

See `tests/server/admin-auth.test.ts` for the canonical example:

```typescript
process.env.NODE_ENV = 'test';
import request from 'supertest';
import app from '../../server/src/app';

describe('POST /api/admin/login', () => {
  it('returns 200 with correct password', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ password: 'test-admin-pass' });
    expect(res.status).toBe(200);
  });
});
```

### 5.2 Testing Authenticated Routes

For routes behind `requireAuth` or `requireQuartermaster`, use the
authenticated agent helpers:

```typescript
import { createAuthAgent } from './helpers/auth';

describe('Computers API', () => {
  const agent = createAuthAgent('QUARTERMASTER');

  it('GET /api/computers returns 200', async () => {
    const res = await agent.get('/api/computers');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/computers creates a computer', async () => {
    const res = await agent
      .post('/api/computers')
      .send({ siteId: 1 });
    expect(res.status).toBe(201);
    expect(res.body.qrCode).toBeDefined();
  });
});
```

### 5.3 Testing Error Cases

Always test:
- 401 for unauthenticated requests
- 403 for insufficient role
- 400 for invalid input
- 404 for missing resources
- 409 for duplicate/conflict

### 5.4 What to Test at This Layer

- Route handler logic: correct status codes, response shapes
- Middleware behavior: auth checks, input validation
- Query parameter filtering
- Audit log writes (verify via response or follow-up GET)

---

## 6. End-to-End Tests (Playwright)

E2E tests run a real browser against a running dev server. They verify
full user workflows including navigation, form submission, and visual
feedback.

### 6.1 Setup

Install Playwright:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

Configuration is at `playwright.config.ts` in the project root.

### 6.2 Running

```bash
npm run test:e2e
```

The Playwright config can optionally start the dev server automatically.
For manual control, start the server with `NODE_ENV=test` or
`NODE_ENV=e2e`:

```bash
NODE_ENV=e2e npm run dev
```

This enables the test-login routes so Playwright can authenticate.

### 6.3 Auth Fixtures

Use the custom auth fixtures instead of raw Playwright `test`:

```typescript
import { test, expect } from '../fixtures/auth';

test('instructor sees computer list', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/computers');
  await expect(authenticatedPage.locator('h1')).toHaveText('Computers');
});

test('quartermaster can add a computer', async ({ quartermasterPage }) => {
  await quartermasterPage.goto('/computers/new');
  // fill form...
});
```

### 6.4 What to Test at This Layer

- Critical user journeys: login → navigate → create → verify
- Form validation feedback (error messages render)
- Navigation between pages
- Role-based UI (Quartermaster sees edit buttons, Instructor doesn't)

---

## 7. Test Conventions

### File Naming

- Server API tests: `tests/server/<feature>.test.ts`
- Database tests: `tests/db/<feature>.test.ts`
- E2E tests: `tests/e2e/<feature>.spec.ts`

### Test Structure

```typescript
describe('<Feature>', () => {
  describe('<Endpoint or Function>', () => {
    it('<expected behavior>', async () => {
      // Arrange → Act → Assert
    });
  });
});
```

### Environment

- Set `process.env.NODE_ENV = 'test'` at the top of every server test
  file, before any imports.
- Set `process.env.ADMIN_PASSWORD` when testing admin routes.
- Database tests set `DATABASE_URL` to point at `app_test`.

---

## 8. Client Component Tests (Future)

When ready, install:

```bash
cd client
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

Add to `client/vite.config.ts`:

```typescript
export default defineConfig({
  // ... existing config ...
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

Create `client/src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

Run with `npm run test:client`.

---

## 9. CI Integration

When CI is set up, the test pipeline should run in order:

1. `npm run test:db` — Database tests (requires Postgres)
2. `npm run test:server` — API tests (no database required for existing
   tests; new tests may need test DB)
3. `npm run test:client` — Component tests (no server required)
4. `npm run test:e2e` — E2E tests (requires full stack running)

Each layer catches different classes of bugs. Database tests catch
schema and constraint issues. API tests catch route logic errors. E2E
tests catch integration and UI issues.
