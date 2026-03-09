---
id: '005'
title: Fix TypeScript build errors for production Docker build
status: done
use-cases: []
depends-on: []
---

# Fix TypeScript build errors for production Docker build

## Description

The production Docker build (`docker/Dockerfile.server`) fails due to
TypeScript errors that don't surface during local development.

**Server**: The Dockerfile runs `npx tsc && npx prisma generate` — prisma
generate must run first so Prisma client types are available. Swap to
`npx prisma generate && npx tsc`.

**Client**: `tsc -b` (used by `npm run build`) applies `tsconfig.app.json`
which enables `noUnusedLocals`, `noUnusedParameters`, and
`verbatimModuleSyntax`. Plain `tsc --noEmit` uses the root tsconfig with
`"files": []` and checks nothing, so these errors don't appear locally.

12 client errors across 6 files:

- `AppLayout.tsx:136` — `useRef<>()` needs initial `undefined` arg
- `SearchPage.tsx:33` — same `useRef` issue
- `AdminLogin.tsx:1` — `FormEvent` needs `type` import keyword
- `ComputerDetail.tsx:10` — unused `Custodian` interface
- `InactiveComputers.tsx:33` — `.includes()` type mismatch (string vs literal union)
- `KitDetail.tsx` (6 errors) — unused vars (`saving`, `dirty`, `qrCode`,
  `updateField`, `handleSave`, `inputClass`) and missing `categoryId` in
  a FormState object literal

## Acceptance Criteria

- [ ] Dockerfile runs `npx prisma generate` before `npx tsc`
- [ ] All 12 client TypeScript errors are fixed
- [ ] `cd client && npx tsc -b --noEmit` passes with zero errors
- [ ] Production Docker build completes successfully

## Testing

- **Verification command**: `cd client && npx tsc -b --noEmit`
- **Verification command**: `DOCKER_CONTEXT=swarm1 docker compose -f docker-compose.prod.yml build server`
