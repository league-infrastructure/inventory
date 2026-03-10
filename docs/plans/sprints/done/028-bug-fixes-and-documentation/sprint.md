---
id: 028
title: Bug Fixes and Documentation
status: done
branch: sprint/028-bug-fixes-and-documentation
use-cases: []
---

# Sprint 028: Bug Fixes and Documentation

## Goals

Fix bugs from sprint 027 and add missing documentation. This is an
open-ended bug fix sprint that will stay open while issues are resolved.

## Problem

1. Admin backup button returns 500 in local development — the docker
   compose exec fallback for pg_dump is failing.
2. MCP Setup page needs instructions for the new OAuth connector flow.

## Solution

1. Investigate and fix the backup failure at the correct layer.
2. Add OAuth setup instructions to the MCP configuration page.

## Success Criteria

- Admin backup button works in local dev
- MCP Setup page documents how to connect Claude via OAuth

## Scope

### In Scope

- Backup service bug fix
- MCP Setup page documentation

### Out of Scope

- New features
- Refactoring

## Test Strategy

- Run `npm run test:server` after backup fix
- Manual verification of backup button in local dev

## Architecture Notes

No architecture changes expected — these are bug fixes and docs.

## Tickets

| # | Title | Status |
|---|-------|--------|
| 001 | Fix admin backup 500 error in local development | todo |
| 002 | Update MCP Setup page with OAuth connector instructions | todo |
