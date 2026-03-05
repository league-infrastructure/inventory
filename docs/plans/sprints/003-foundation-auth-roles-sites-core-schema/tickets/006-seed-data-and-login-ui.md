---
id: "006"
title: "Seed data and login UI"
status: todo
use-cases: []
depends-on: ["001", "002", "005"]
---

# Seed data and login UI

## Description

Create a Prisma seed script that populates initial data, and build the
login/landing page UI that replaces the template's ExampleIntegrations page.

## Acceptance Criteria

- [ ] Prisma seed script (`server/prisma/seed.ts`) creates home sites: "Carmel Valley" and "Robot Garage (Busboom)"
- [ ] Seed script creates initial host name pool (at least 20 computer scientist names)
- [ ] Seed script is idempotent (can be run multiple times without duplicating data)
- [ ] `package.json` has a `prisma.seed` configuration pointing to the seed script
- [ ] Landing page (`/`) shows a login button when unauthenticated (Google OAuth login)
- [ ] Landing page shows user info and role when authenticated (name, email, role badge)
- [ ] Navigation includes links to Site management (Quartermaster only) and admin dashboard
- [ ] The template's ExampleIntegrations page is replaced with the inventory app landing page
- [ ] Remove unused template routes/pages (counter demo, integrations page)

## Testing

- **Existing tests to run**: `cd server && npm test`
- **New tests to write**: Seed script runs without errors, seed data is present after run
- **Verification command**: `cd server && npx prisma db seed`
