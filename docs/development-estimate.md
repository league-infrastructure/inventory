# LAP Inventory System — Traditional Development Estimate

Using the rubric from [web_app_estimation_rubric.md](web_app_estimation_rubric.md), applied against 30 completed sprints with 175 total tickets, and a Prisma schema with 22 models.

---

## 1. Project Setup & Infrastructure

| Task | Hours | Rationale |
|------|:-----:|-----------|
| Repository setup (Git, Docker configs, multi-env, README) | 3 | Moderate — Docker + SOPS + multi-environment |
| Dev environment (Docker Compose: Node + PostgreSQL) | 6 | Multi-service Docker Compose with wait scripts, entrypoint |
| Framework scaffolding (Express + React + Vite + TypeScript + Prisma) | 3 | CLI generators, but dual client/server setup |
| Database schema design (22 models, complex relationships) | 14 | High end — 22 models, 10+ foreign keys, indexes, enums |
| CI/CD + Docker Swarm deployment pipeline w/ SOPS secrets | 14 | Sprints 025, 027 — Swarm + SOPS + secret rotation |
| Production deployment (Docker Swarm, Caddy, SSL, DNS) | 12 | Sprint 025 alone was 24 tickets; substantial ops work |
| Domain, SSL, DNS configuration | 3 | Caddy auto-TLS, custom domain |
| Monitoring/logging (health endpoint, log buffer, scheduler) | 6 | Sprint 002, 027 — ring buffer, scheduled jobs, health checks |

**Subtotal: 61 hours**

---

## 2. Authentication & Authorization

| Task | Hours | Rationale |
|------|:-----:|-----------|
| Google OAuth (domain-restricted, Passport.js) | 6 | Sprint 001 + 003 — standard library but domain restriction adds complexity |
| GitHub OAuth | 3 | Sprint 001 — incremental after Google |
| Admin password auth | 4 | Sprint 002 — existing template pattern |
| Role-based access (Instructor / Quartermaster / Admin + email pattern matching) | 12 | Sprint 003 — three roles with regex pattern matching is high end of RBAC |
| Session management & security | 4 | connect-pg-simple, secure cookies |
| API Token system (create / hash / revoke) | 10 | Sprint 010 — full token lifecycle with hashing |
| OAuth for MCP (authorization code + PKCE) | 12 | Sprints 027, 029 — PKCE flow, stash params through Google redirect |
| Token authentication middleware | 4 | Sprint 010 — bearer token extraction + role injection |

**Subtotal: 55 hours**

---

## 3. CRUD Features (Per Entity)

**Simple CRUD (4–10h each):**

| Entity | Hours | Notes |
|--------|:-----:|-------|
| Site | 8 | GPS coords, isHomeSite constraint, active flag |
| HostName | 6 | Pool management, computer assignment |
| OperatingSystem | 5 | Name-only with validation |
| Category | 5 | Name-only, used by Kit + Computer |
| QuartermasterPattern | 6 | Pattern + isRegex, admin-only |
| Note | 6 | Polymorphic (objectType/objectId) |

**Medium CRUD (8–20h each):**

| Entity | Hours | Notes |
|--------|:-----:|-------|
| Pack | 16 | Kit relationship, QR code, image, items cascade |
| Item | 12 | Two types (counted/consumable), pack relationship |
| Issue | 18 | 5 types, status workflow, 4 optional parent relations |
| Transfer | 18 | Chain-of-custody, GPS, polymorphic (Kit/Computer) |
| InventoryCheck + Lines | 18 | Checklist with line items, discrepancy detection |
| Image | 14 | S3 storage, upload, resize, checksum, migration from bytea |
| ApiToken | 12 | Hashing, prefix display, revocation, expiry |
| AuditLog | 14 | Append-only, source tracking, complex query filters |

**Complex CRUD (16–40h each):**

| Entity | Hours | Notes |
|--------|:-----:|-------|
| Kit | 32 | 8 relationships, QR, clone operation, status, container types, categories |
| Computer | 32 | 10+ fields, 7 disposition states, host name assignment, QR, 6 relationships |
| User | 16 | OAuth persistence, role management, pattern-based promotion |

**Subtotal: 238 hours** (17 CRUD entities)

---

## 4. UI/UX & Frontend

| Task | Hours | Notes |
|------|:-----:|-------|
| UI framework + base layout | 5 | React + component system |
| Responsive navigation (sidebar, mobile) | 8 | Sidebar with role-based sections |
| Instructor Dashboard | 12 | My checkouts, activity, issues |
| Quartermaster Dashboard | 16 | System-wide: all checkouts, issues, overdue inventory, audit feed |
| Admin Dashboard (8 panels: env, DB viewer, config, logs, sessions, tokens, jobs, backups) | 24 | Sprints 002, 021, 027 |
| Landing page (public QR scan) | 4 | Unauthenticated - org info + login prompt |
| Account page + MCP Setup page | 10 | Token management, MCP connector instructions |
| Complex forms (~12 forms × 4h avg) | 48 | Kit, Computer, Pack, Item, Issue, Transfer, Import, etc. |
| Data tables with search/sort/pagination (~8 views) | 32 | Kits, Computers, Packs, Issues, Transfers, Users, Hostnames, Sites |
| Toast notification system | 4 | Sprint 010 |
| Responsive design & mobile optimization | 12 | Mobile-first QR workflows |
| Error handling & loading states | 4 | Global error boundaries, spinners |
| Mobile QR pages (kit, pack, computer) | 16 | Sprint 024 — dedicated mobile UX |
| Transfer modal UI | 8 | Sprint 019 — custodian + site selection with GPS |
| Import/Export UI with diff preview | 12 | Sprint 015 — review-before-apply workflow |
| Label print modal (batch selection) | 6 | Sprint 014 |
| Issue queue UI | 8 | Sprint 013 — filters, resolution |
| Inventory check UI | 10 | Sprint 012 — checklists, discrepancies |
| Report pages (7 reports) | 24 | Sprint 016 — kit detail, computer detail, checkout history, age, user activity, etc. |
| Search results + Audit log query pages | 16 | Sprint 016 — grouped results, date/field filters |
| AI Chat modal (SSE streaming, markdown) | 12 | Sprint 011, 026 |

**Subtotal: 311 hours**

---

## 5. Common Feature Modules

| Feature | Hours | Sprint(s) |
|---------|:-----:|-----------|
| QR code generation (3 entity types) | 6 | 004, 006 |
| Label printing / PDF (4 formats, batch) | 14 | 014, 026 |
| Excel/CSV import with diff/conflict detection | 12 | 015 |
| Excel/CSV export | 6 | 015 |
| JSON import/export | 6 | 021 |
| Global search across all types | 10 | 016 |
| Reporting (7 report types) | 20 | 016 |
| Audit logging (comprehensive, all operations) | 10 | 003+ |
| Image upload + S3 storage + bytea migration | 12 | 023 |
| Database backup/restore + rotation + S3 | 12 | 021, 027 |
| Job scheduler (tick-based, request piggyback) | 10 | 027 |
| Kit cloning | 6 | 004 |
| GPS/geolocation (site suggestion, nearest) | 6 | 007, 025 |
| Description parser (auto-create items, fuzzy match) | 6 | 010 |

**Subtotal: 136 hours**

---

## 6. Third-Party Integrations

| Integration | Hours | Sprint(s) |
|-------------|:-----:|-----------|
| Google OAuth (Passport.js) | 6 | 001, 003 |
| GitHub OAuth (Passport.js) | 4 | 001 |
| Pike 13 API proxy | 6 | 001 |
| Slack bot (AI-powered inventory) | 16 | 025 |
| Slack slash commands + fixes | 8 | 025, 026 |
| Slack conversation persistence | 4 | 030 |
| S3 / DigitalOcean Spaces | 10 | 023 |
| AI model integration (OpenAI/Claude, SSE streaming, tool execution) | 20 | 011, 031 |
| Nominatim geocoding | 4 | 023, 025 |
| MCP server (Streamable HTTP transport, 30+ tools) | 24 | 010, 028, 029 |

**Subtotal: 102 hours**

---

## 7. Service Layer & Architecture

Sprints 008 and 009 were entirely dedicated to architectural refactoring:

| Task | Hours | Sprint |
|------|:-----:|--------|
| Service error types & error handler | 6 | 008 |
| Data contract interfaces (all entities) | 12 | 008 |
| Base service abstract class | 8 | 009 |
| Domain service implementations (~15 services) | 32 | 008, 009 |
| Route migration to thin HTTP adapters | 16 | 008, 009 |
| Service registry & dependency injection | 6 | 009 |

**Subtotal: 80 hours**

---

## 8. Testing & QA

| Task | Hours | Notes |
|------|:-----:|-------|
| Test infrastructure (Jest, Supertest, test DB) | 4 | Sprint 001 |
| E2E infrastructure (Playwright) | 6 | Playwright config present |
| Unit tests (~15 service modules) | 24 | Sprint 009 |
| Integration tests (API round-trip) | 16 | Sprint 008 |
| Database tests | 8 | tests/db/ with helpers |
| Bug fixing (sprints 022, 026, 028–030 ≈ 23 tickets) | 46 | Five dedicated bug-fix sprints |
| Manual QA rounds | 16 | Cross-sprint regression |

**Subtotal: 120 hours**

---

## 9. Documentation

| Task | Hours | Files |
|------|:-----:|-------|
| Technical documentation (8 guides) | 16 | setup, deployment, secrets, api-integrations, testing, mcp, template-spec, label-spec |
| API/contract documentation | 8 | contracts.md |

**Subtotal: 24 hours**

---

## Summary

| Category | Hours |
|----------|------:|
| 1. Project Setup & Infrastructure | 61 |
| 2. Authentication & Authorization | 55 |
| 3. CRUD Features (17 entities) | 238 |
| 4. UI/UX & Frontend | 311 |
| 5. Common Feature Modules | 136 |
| 6. Third-Party Integrations | 102 |
| 7. Service Layer & Architecture | 80 |
| 8. Testing & QA | 120 |
| 9. Documentation | 24 |
| **Raw Development Total** | **1,127** |

### Multipliers (per rubric)

| Multiplier | Rate | Hours |
|------------|:----:|------:|
| PM / communication overhead | +15% | +169 |
| Code review | +10% | +113 |
| Risk / uncertainty buffer | +20% | +225 |
| *(Testing already itemized — no additional QA multiplier)* | — | — |
| **Grand Total** | | **1,634** |

### Calendar Time (Traditional)

At 32 effective hours/week (rubric standard for a single mid-level full-stack developer):

> 1,634 hours ÷ 32 hours/week = 51 weeks ≈ **12.8 months**

### Complexity Tier Classification

This application falls at the **low end of Complex** per the rubric's aggregate tiers:

| Indicator | This Project |
|-----------|-------------|
| CRUD entities | 17 (rubric threshold: 15+ = Complex) |
| Auth | Google OAuth + RBAC + API tokens + MCP OAuth (Complex) |
| Integrations | 7+ (Slack, S3, AI/LLM, MCP, geocoding, 2× OAuth, Pike 13) |
| Real-time | SSE streaming for AI chat |
| PDF generation | 4 label formats with batch printing |
| Import/export | Excel + JSON with diff/conflict preview |
| Mobile | Dedicated QR-driven mobile workflows |
| Architecture | Full service layer with DI, contracts, base class |

The rubric's Complex tier range is **1,200–2,500+ hours / 6–12+ months**. At **1,634 hours / ~13 months**, this sits right at the boundary — a complex application, but not at the extreme end. The scope is equivalent to roughly **5–6 months with a team of 2–3 developers**.

---

## Actual: AI-Assisted Development

This application was built using **Claude Code** in **4 calendar days**.

| Metric | Traditional Estimate | Actual (AI-assisted) |
|--------|--------------------:|---------------------:|
| Calendar time | ~13 months | **4 days** |
| Estimated effort | 1,634 hours | ~40–48 hours* |
| Speedup (effort) | 1× | **~34–41×** |
| Speedup (calendar) | 1× | **~96×** |

*Assuming 10–12 effective hours/day over 4 intense days with AI tooling.*

### Where AI Acceleration Was Greatest

Per the rubric, AI shows the largest speedups on:

- **Boilerplate/scaffolding** — 17 CRUD entities, service layer, contracts
- **UI component creation** — ~311 hours of frontend estimated
- **Test writing** — 120 hours of testing estimated
- **Documentation** — 24 hours of docs estimated

### Where AI Acceleration Was Smallest

- Complex business logic
- Debugging integration issues (5 bug-fix sprints)
- Architecture decisions
- Security hardening

### Key Observations

- The architecture work (service layer, contracts, OO refactor — sprints 008, 009) was itself largely boilerplate-pattern work once the design was decided — exactly the kind of work AI accelerates most.
- 175 tickets across 30 sprints in 4 days = ~44 tickets/day, only possible because the AI (via the CLASI process) is both the planner and the executor.
- The project used the CLASI software engineering process throughout, providing structured sprint planning, ticketing, and execution tracking that kept the AI focused and productive.
