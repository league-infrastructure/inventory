---
id: '002'
title: Loan-only custodians & hostname schemes
status: planning-docs
branch: sprint/002-loan-only-custodians-hostname-schemes
use-cases:
  - SUC-001
  - SUC-002
  - SUC-003
  - SUC-004
  - SUC-005
  - SUC-006
  - SUC-007
  - SUC-008
issues:
  - add-student-and-partner-user-roles-for-loan-only-custodians.md
  - add-scheme-field-to-hostname-discrete-value-column-filters.md
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Sprint 002: Loan-only custodians & hostname schemes

## Goals

1. Allow equipment to be loaned to non-staff custodians (students and external
   partners) by introducing `STUDENT` and `PARTNER` UserRole values, with no
   login access and automatic `disposition = LOANED` on transfer.
2. Track the naming universe of each HostName via a `scheme` free-text field,
   and give the hostnames list sortable/filterable scheme and status columns
   with inline edit.

## Problem

Equipment is currently loanable only to staff users with Google login. Students
and external partners who receive equipment temporarily have no representation in
the system — admins must use staff accounts as proxies or leave the custodian
field blank, breaking transfer history.

The hostnames list has no way to distinguish naming conventions (e.g.
"computer scientists" vs. "computer graphics terms") and the Status column has
no filter. The MCP agent cannot set scheme on HostName records it creates.

## Solution

**Student/Partner custodians**: Add `STUDENT` and `PARTNER` to the `UserRole`
enum. These roles carry no login rights (blocked at OAuth callback and
`requireAuth`). Admins create them from the existing UsersPanel with nullable
email and an optional `notes` field. All four custodian-picker dropdowns render
a staff-then-divider-then-loanees layout via a new shared `<CustodianSelect>`
component. The transfer service sets `Computer.disposition = LOANED`
automatically when the incoming custodian is a STUDENT or PARTNER.

**Hostname schemes**: Add `scheme String?` to the `HostName` Prisma model.
Extend `create_hostname` and `update_hostname` MCP tools to accept scheme. Add
`PUT /api/hostnames/:id` and `GET /api/hostnames/schemes` routes. Extend
`SortableHeader` with a `filterMode: 'discrete'` prop. Update the HostName list
page with a Scheme column, a discrete-filter Status column, and inline edit with
`<datalist>` autocomplete for scheme.

## Success Criteria

- Admin can create a STUDENT/PARTNER user with no email from UsersPanel; the
  user appears in all custodian pickers below a divider.
- Transferring equipment to a STUDENT/PARTNER automatically sets disposition to
  LOANED.
- STUDENT/PARTNER users cannot log in via Google OAuth.
- Hostnames list shows Scheme column; both Scheme and Status columns have
  discrete dropdown filters.
- MCP tools `create_hostname` and `update_hostname` accept `scheme`.
- `tsc --noEmit` clean in both server and client; existing test suites pass.

## Scope

### In Scope

- `UserRole` enum: add `STUDENT`, `PARTNER`
- `User.email` nullable + audit pass on all display sites
- `User.notes` optional field
- Admin users route: accept new roles, null email, notes; add `requireAdmin`
- OAuth callback + `requireAuth`: reject STUDENT/PARTNER
- `/auth/users` endpoint: return `role`, sort staff first
- Transfer service: auto-set `Computer.disposition = LOANED`
- `CustodianSelect` shared component (staff / divider / loanees)
- 4 custodian-picker file updates (ComputerDetail, TransferModal, KitDetail,
  TransferAction)
- `roles.ts` client-side role labels/styles for STUDENT and PARTNER
- UsersPanel: STUDENT/PARTNER in role dropdown, optional email, notes textarea
- `HostName.scheme String?` Prisma field + migration
- HostName contracts, service, and routes (`PUT /hostnames/:id`,
  `GET /hostnames/schemes`)
- MCP tool schema updates for `create_hostname` and `update_hostname`
- `SortableHeader` `filterMode: 'discrete'` + `discreteOptions` prop
- HostName list: Scheme column, Status discrete filter, inline edit with datalist

### Out of Scope

- Removing the existing `CUSTODIAN` enum value (Postgres enum removal is risky)
- Auto-LOANED for Kit disposition (Kit may not have a disposition field; verify
  during implementation — computer-only if Kit lacks it)
- Custom dropdown to replace native `<select>` in custodian picker
- Dedicated "Loanees" admin tab (UsersPanel handles all roles)
- STUDENT/PARTNER badges on computer/kit detail headers
- Bulk MCP update tools for scheme backfill (MCP agent loops individually)
- Backfilling existing HostName records (default null; agent handles later)
- Index on `HostName.scheme` (defer until scale warrants it)
- Dropping the deprecated `manufacturer String?` column (separate sprint)

## Test Strategy

Verification against the running dev server is the primary gate (both issues
have detailed end-to-end verification checklists). `tsc --noEmit` must be clean
in server and client after each ticket. The existing `npm run test:server` and
`npm run test:client` suites must pass (or report only the pre-existing
"no test files" result).

## Architecture Notes

- The two feature tracks (student/partner, hostname schemes) are structurally
  independent. No cross-feature dependencies at the code level.
- Server sorts `/auth/users` staff-first so all four client pickers share
  identical rendering logic via `<CustodianSelect>` — no per-picker bucketing.
- `HostName.scheme` uses `NULL` for unset (not empty string) to allow a future
  `IS NOT NULL` filter without ambiguity.
- `SortableHeader` discrete-filter extension is standalone: no changes to
  `useTableSort`; exact-match `select` value works through the existing
  `includes` filter.

## GitHub Issues

(None — these are internal CLASI issues, not GitHub issues.)

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [x] Sprint planning documents are complete (sprint.md, use cases, architecture)
- [x] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

| # | Title | Depends On |
|---|-------|------------|
| 001 | Student/Partner schema & server foundation | — |
| 002 | HostName scheme schema, server & MCP foundation | — |
| 003 | Transfer service auto-LOANED disposition | 001 |
| 004 | SortableHeader discrete-filter mode | — |
| 005 | Student/Partner client — CustodianSelect & UsersPanel | 001, 003 |
| 006 | HostName list UX — scheme column, status filter, inline edit | 002, 004 |

Tickets execute serially in the order listed. Tickets 001, 002, and 004 have
no dependencies and can begin immediately. Within each track, tickets must
execute in order. There are no cross-track dependencies.
