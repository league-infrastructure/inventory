---
status: done
sprint: '025'
tickets:
- '015'
---

# Fix TypeScript build errors for production Docker build

The production Docker build (`docker/Dockerfile.server`) fails due to
TypeScript errors that don't surface during local development.

## Server errors

The Dockerfile runs `npx tsc && npx prisma generate` — prisma generate
must run first so Prisma client types are available. Swapping the order
to `npx prisma generate && npx tsc` fixes all server build errors.

## Client errors

`tsc -b` (used by `npm run build`) uses `tsconfig.app.json` which enables
`noUnusedLocals`, `noUnusedParameters`, and `verbatimModuleSyntax`. Plain
`tsc --noEmit` uses the root tsconfig which has `"files": []` and checks
nothing, so these errors don't appear locally.

12 errors across 6 files:

- `AppLayout.tsx:136` — `useRef<>()` needs initial `undefined` arg
- `SearchPage.tsx:33` — same `useRef` issue
- `AdminLogin.tsx:1` — `FormEvent` needs `type` import keyword
- `ComputerDetail.tsx:10` — unused `Custodian` interface
- `InactiveComputers.tsx:33` — `.includes()` type mismatch (`string` vs literal union)
- `KitDetail.tsx` (6 errors) — unused vars (`saving`, `dirty`, `qrCode`,
  `updateField`, `handleSave`, `inputClass`) and missing `categoryId` in
  a FormState object literal
