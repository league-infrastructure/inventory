# JTL Inventory — Project Overview

> Reverse-engineered from the codebase as of version **0.20260721.1** (2026-07-21).
> This is an elevator-pitch summary. See `specification.md` for the full
> as-built feature spec and `usecases.md` for numbered use cases.

## What It Is

**JTL Inventory** (repo name `inventory`, product-facing name "League of
Amazing Programmers — Inventory System") is a mobile-first web application
that tracks the physical fleet of teaching equipment — computers, kits
(equipment totes/bags), and the packs and items inside them — used by
**JointheLeague (LAP)**, a nonprofit coding school, across roughly 30 school
and community teaching sites. It replaces a manually maintained Google
Sheet with an audited, QR-code-driven inventory system: instructors scan a
kit's or computer's printed label to check it in or out, report a problem,
or run an inventory count from their phone; quartermasters manage the
catalog, sites, and audit history from a desktop-oriented console.

## Who Uses It

Six roles are declared in the schema, but only three carry distinct,
day-to-day meaning in the application:

| Role | What they can do |
|------|-------------------|
| **Instructor** | Signs in with a `jointheleague.org` Google account. Views the catalog, checks kits/computers in and out, runs inventory checks, reports and resolves issues, prints labels, uses search/AI chat. Cannot create, edit, or delete catalog records (sites, kits, computers, etc.). This is the default role for any new Google sign-in. |
| **Quartermaster** | Everything an Instructor can do, plus full CRUD on sites, kits, packs, items, computers, categories, manufacturers, operating systems, and host names; CSV/Excel import-export; audit-log and reporting views; API token management for AI/MCP clients. Google users are auto-promoted to this role at every login by matching their email against admin-configured patterns (exact string or regex). |
| **Admin** | A separate, fixed-password login (independent of Google OAuth, though a Google-authenticated user can also be flagged ADMIN) that unlocks the `/admin` console: user management, runtime configuration, a read-only database browser, log/session viewers, scheduled-job control, backup management, and the soft-delete trash bin. |

Three further roles — `CUSTODIAN`, `STUDENT`, `PARTNER` — exist in the
`UserRole` enum. `STUDENT` and `PARTNER` are "loanee" roles: they cannot
sign in via Google OAuth at all and exist only as custodian records for
kits/computers on loan to them. `CUSTODIAN` is a selectable label in the
admin Users panel with no distinct authorization behavior — functionally
it behaves identically to `INSTRUCTOR`. See `specification.md` for detail.

## Core Domains

- **Catalog**: Sites → Kits → Packs → Items, plus standalone Computers and
  Host Names, organized by Category and Manufacturer.
- **Custody & movement**: a single `Transfer` model records every change of
  custodian and/or site for a Kit or Computer. This *is* the checkout/
  check-in mechanism — there is no separate "checked out" flag; "checked
  out" simply means the object's current custodian is non-null.
- **Condition tracking**: Inventory Checks (expected-vs-actual counts per
  kit/pack, with discrepancy detection), Issues (typed problem reports),
  Notes (free-text annotations), and Computer Disposition (ACTIVE,
  LOANED, NEEDS_REPAIR, IN_REPAIR, SCRAPPED, LOST, DECOMMISSIONED).
- **Physical identification**: auto-generated QR codes and printable PDF
  labels (Dymo 59×102mm) for kits, packs, and computers.
- **Discovery**: unified search across kits/packs/items/computers/sites/
  users/hostnames/categories/manufacturers; audit-log, inventory-age, and
  checked-out-by-person reports.
- **Admin console**: config, users, sessions, DB viewer, logs, scheduled
  jobs (backup rotation), trash/restore.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Client | React + TypeScript, built with Vite |
| Server | Express 4 + TypeScript on Node.js 20 |
| Database | PostgreSQL 16 via Prisma ORM |
| Object storage | DigitalOcean Spaces (S3-compatible) — uploaded images and DB backups |
| Orchestration | Docker Compose (dev), Docker Swarm (prod) |
| Reverse proxy | Caddy, `inventory.jointheleague.org` |
| AI process | CLASI (Claude Agent Skills Instructions) for the engineering workflow itself |

## Key Integrations

- **Google OAuth** (domain-restricted to `jointheleague.org`) — the
  primary sign-in path for Instructors and Quartermasters.
- **Anthropic Claude** — powers an in-app AI chat assistant (an agentic
  tool-use loop over the same service layer the UI uses) and an **MCP
  server** (`/api/mcp`, Streamable HTTP transport) that lets external AI
  clients (Claude Desktop, Claude Code, the claude.ai web connector) read
  and mutate inventory data via a personal API token or an OAuth/PKCE flow.
- **Slack** — an HMAC-verified bot (event subscriptions plus slash
  commands like `/inventory`, `/whereis`, `/checkout`) that routes
  free-text questions through the same AI chat engine and answers a few
  queries with hand-coded lookups.
- **GitHub OAuth** and **Pike13** — routes, Passport strategies, and
  admin-config entries inherited from the underlying "Docker Node
  Application Template" this project was built from. No inventory-domain
  feature currently uses either integration (no client UI beyond a
  configured/not-configured flag on the admin Environment page); see
  `specification.md`'s open questions for whether these should be removed
  or are reserved for future use.

## Versioning

The project follows a `0.YYYYMMDD.N` version scheme (documented in
`AGENTS.md`): a bump on every commit, `N` incrementing per day. The
current version, `0.20260721.1`, is the snapshot this document set
describes.
