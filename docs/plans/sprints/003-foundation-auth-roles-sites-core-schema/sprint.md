---
id: '003'
title: "Foundation \u2014 Auth, Roles, Sites, Core Schema"
status: active
branch: sprint/003-foundation-auth-roles-sites-core-schema
use-cases: []
---

# Sprint 003: Foundation — Auth, Roles, Sites, Core Schema

## Goals

Stand up the authentication system, role model, site management, and core
database schema that all subsequent sprints build on.

## Problem

The application template already has working Google and GitHub OAuth via
Passport.js (`server/src/routes/auth.ts`), a fixed-password admin dashboard,
and session management with PostgreSQL persistence. However, it lacks:
domain restriction on Google OAuth, a User table (OAuth profiles are
session-only), role-based access control, and any inventory-specific data
model.

## Solution

- Restrict Google OAuth to jointheleague.org (add `hd` parameter and
  validate domain in callback). Remove or disable GitHub OAuth — not needed
  for this project.
- Create a User model that persists Google profile info and role (Instructor
  or Quartermaster). Upsert on each login.
- Add a Quartermaster access list to the admin dashboard — a list of email
  patterns (literal or regex) that grant Quartermaster privileges on login.
- Implement Site CRUD (name, address, GPS coordinates, home-site flag).
- Create the Prisma schema for all core objects (Kit, Pack, Item, Computer,
  Site, User, Checkout, AuditLog) — tables only, CRUD for most objects
  comes in later sprints.

## Success Criteria

- A jointheleague.org Google user can log in and sees the Instructor view.
- Admin can add an email pattern to the Quartermaster list; matching users
  get Quartermaster privileges on next login.
- A non-jointheleague.org Google user is rejected at login.
- Sites can be created, listed, edited, and deactivated by a Quartermaster.
- Home sites (Carmel Valley, Robot Garage) are seeded in the database.
- All core tables exist with correct relationships and constraints.
- Audit log records are created for Site CRUD operations.

## Scope

### In Scope

- Google OAuth login/logout flow (Passport.js, jointheleague.org domain)
- User model and session management
- Instructor and Quartermaster roles
- Quartermaster access list on admin dashboard (email pattern matching)
- Site CRUD (Quartermaster only)
- Prisma schema for all core objects
- Seed data for home sites
- Audit log table and write-on-change pattern
- Role-based route protection middleware

### Out of Scope

- Kit, Pack, Item, Computer CRUD (sprints 004–005)
- QR code generation (sprint 004)
- Checkout flow (sprint 006)
- Frontend beyond login, site management, and admin dashboard additions

## Test Strategy

- Backend API tests (Jest + Supertest): OAuth callback handling, role
  assignment, Quartermaster pattern matching, Site CRUD endpoints, audit
  log writes.
- Database tests: migration correctness, foreign key constraints, seed data.
- Frontend tests: login flow, admin dashboard Quartermaster list UI.

## Architecture Notes

- **Existing code to build on:**
  - `server/src/routes/auth.ts` — Working Passport.js with Google and
    GitHub OAuth strategies, `/auth/me`, `/auth/logout`.
  - `server/src/routes/admin/auth.ts` — Fixed-password admin login.
  - `server/src/middleware/requireAdmin.ts` — Admin session check.
  - `server/src/app.ts` — Express session with connect-pg-simple,
    Passport serialize/deserialize.
- The existing admin dashboard (fixed password at `/admin`) remains
  unchanged. A new "Quartermaster Access" panel is added to it.
- The Google OAuth strategy needs `hd: 'jointheleague.org'` added to its
  options, and the callback must validate the domain before upserting.
- GitHub OAuth routes can be removed or left disabled (no credentials
  configured for this project).
- Google OAuth users are upserted to a User table on each login; the
  session links to the User record via Passport serialize/deserialize.
- Quartermaster patterns are stored in the Config model or a dedicated
  table. On login, the user's email is matched against all patterns to
  determine role.
- A new `requireQuartermaster` middleware gates catalog and management
  routes.
- The audit log is a single table with polymorphic object references
  (object_type + object_id).

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
