---
status: in-progress
sprint: '002'
tickets:
- 002-001
---

# Add STUDENT and PARTNER user roles for loan-only custodians

## Context

The stakeholder needs to loan equipment (computers, kits) to **people
who aren't staff** — students and external partners. They are
custodians in the sense that they hold and are responsible for the
item, but they have no login access and aren't members of the
jointheleague.org organization.

Today, every `Computer.custodianId` and `Kit.custodianId` points at a
`User` record, and every `User` record can log in via Google OAuth.
There's no provision for "external" custodians.

The chosen design: introduce two new `UserRole` enum values, `STUDENT`
and `PARTNER`. Records with these roles are User rows like any other,
but they:

- have no login access (rejected at the OAuth callback even if they
  somehow get a session),
- show up at the **bottom** of every custodian-picker dropdown,
  separated from staff users by a horizontal divider,
- can be created by admins from the existing UsersPanel with email left
  blank,
- carry an optional `notes` field for free-text context (parent contact,
  partner org, etc.) so admins don't stuff it into `displayName`,
- automatically flip the assigned item's `disposition` to `LOANED`
  when they become its custodian via a transfer.

## Files to modify

**Server**
- [server/prisma/schema.prisma](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/server/prisma/schema.prisma) — `UserRole` enum, `User.email` nullability, `User.notes`
- New migration under `server/prisma/migrations/`
- [server/src/contracts/user.ts](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/server/src/contracts/user.ts) — `USER_ROLES`, `UserRecord` (email becomes `string | null`, add `notes`)
- [server/src/routes/auth.ts](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/server/src/routes/auth.ts) — reject STUDENT/PARTNER at OAuth callback; `/auth/users` returns `role` and is grouped staff-first
- [server/src/middleware/requireAuth.ts](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/server/src/middleware/requireAuth.ts) — belt-and-suspenders: reject STUDENT/PARTNER sessions
- [server/src/routes/admin/users.ts](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/server/src/routes/admin/users.ts) — accept new roles; allow null email for STUDENT/PARTNER; accept `notes`; add `requireAdmin` middleware (pre-existing gap)
- `server/src/services/transfer.service.ts` (find exact path) — when a transfer sets `Computer.custodianId` to a STUDENT/PARTNER, also set `Computer.disposition = LOANED`. Same for Kit if Kit has a disposition equivalent (verify; otherwise computer-only)

**Client**
- [client/src/lib/roles.ts](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/lib/roles.ts) — add STUDENT, PARTNER to `USER_ROLES`, `ROLE_LABELS`, `ROLE_BADGE_STYLES`
- New shared helper `client/src/components/CustodianSelect.tsx` — encapsulates the staff-then-divider-then-loanees rendering of users
- [client/src/pages/computers/ComputerDetail.tsx:434-440](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/pages/computers/ComputerDetail.tsx#L434-L440) — use the shared helper
- [client/src/components/TransferModal.tsx:64-73](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/components/TransferModal.tsx#L64-L73) — use the shared helper
- [client/src/pages/kits/KitDetail.tsx:1024-1033](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/pages/kits/KitDetail.tsx#L1024-L1033) — use the shared helper
- [client/src/pages/qr/actions/TransferAction.tsx:166-177](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/pages/qr/actions/TransferAction.tsx#L166-L177) — use the shared helper
- [client/src/pages/admin/UsersPanel.tsx](../../Volumes/Proj/proj/league-projects/infrastructure/inventory/client/src/pages/admin/UsersPanel.tsx) — add STUDENT/PARTNER to role dropdown; make email optional when role is STUDENT/PARTNER; add `notes` textarea visible for all users but emphasized for STUDENT/PARTNER

**Audit pass (nullable email)**

`User.email` becomes `string | null`. The Plan agent identified the display sites that need a `?? '—'` guard:
- `server/src/routes/auth.ts:156` (return value of `/auth/me`)
- `server/src/services/token.service.ts:72`
- `client/src/components/AppLayout.tsx:372`, `client/src/pages/account/Account.tsx:112`, `client/src/pages/admin/UsersPanel.tsx:298`, `client/src/pages/admin/AdminTokens.tsx:109`

`server/src/routes/oauth.ts:92,235` calls `emailToClientId(user.email)` — only run for logged-in users, so email will be present. Add an invariant assertion at the OAuth-authorize entry rather than scattering `!` casts.

`server/src/routes/admin/users.ts:67-69,76` (the create endpoint's email-required check and the uniqueness check) must skip when the role is STUDENT/PARTNER and email is null/empty.

## Implementation outline (suggested ticket breakdown)

This is multi-layer. Likely 3 tickets:

1. **Schema + server foundation.** UserRole enum values, email nullable, notes column, migration, contracts, admin POST/PUT updates, requireAdmin middleware on `/api/admin/users`, OAuth-callback rejection, requireAuth belt-and-suspenders, audit-pass on nullable email. Includes server-side grouped sort in `/auth/users`.

2. **Transfer service + LOANED disposition.** When a transfer assigns custody to a STUDENT/PARTNER, set `Computer.disposition = LOANED`. (Verify whether Kit needs a parallel change.) This is a small focused server change.

3. **Client.** Build `<CustodianSelect>` shared component with the staff/divider/loanees layout using `<option disabled>──────</option>` as the separator. Replace the inline custodian selects in the 4 picker locations. Update `roles.ts` with new role labels/styles. Extend UsersPanel: STUDENT/PARTNER in role dropdown, email field optional, notes textarea.

## Verification

End-to-end test against the running dev server:

1. **Admin creation flow** — log in as admin → UsersPanel → "Add user" → role = STUDENT, leave email blank, set displayName = "Alice Test", notes = "parent: alice.mom@…". Save. Confirm row appears in the list.

2. **Custodian picker rendering** — open a computer detail page → custodian dropdown. Confirm staff users appear alphabetically at the top, a horizontal-rule-looking line (the disabled em-dash option) appears next, and "Alice Test" appears below it. Confirm a PARTNER record sorts alphabetically within the loanee section.

3. **Loan transfer** — assign the computer to Alice via the picker. Confirm:
   - The Transfer log entry records the toCustodian as "Alice Test".
   - `Computer.disposition` is now `LOANED`.
   - The computer list view shows the LOANED disposition.

4. **Login attempt** — manually flip an existing OAuth user's role to STUDENT in the DB (or create one with a real jointheleague.org email and STUDENT role). Attempt Google login. Confirm the OAuth callback rejects the session and redirects to an access-denied page.

5. **Email nullability audit** — load `/admin/users`, `/account`, `/admin/tokens`, and the app header. Confirm no `null` or `undefined` leaks visibly when the user has no email.

6. **Tests** — `npx tsc --noEmit` clean in both server and client. `npm run test:server` and `npm run test:client` either pass or report only the pre-existing "no test files" empty result.

## Out of scope

- Removing or repurposing the unused `CUSTODIAN` enum value. Postgres enum removal is awkward; leave it as cleanup.
- Replacing native `<select>` with a custom dropdown. The disabled-option divider is conventional and accessible enough.
- Auto-LOANED behavior for Kits (verify whether Kit has a comparable disposition; if not, this is only a Computer change).
- A dedicated "Loanees" admin tab. Same UsersPanel handles them.
- Surfacing STUDENT/PARTNER badges in the computer/kit detail header (separate small UX polish).

## Open questions resolved during planning

- **Email storage**: nullable (`email String? @unique`). Postgres treats NULL as distinct under unique constraints, so multiple blank-email loanees work.
- **Divider technique**: `<option disabled>──────</option>` inside the native `<select>`.
- **Server vs client bucketing**: server sorts staff-first and exposes `role` on each entry so clients can render the divider consistently with no per-picker bucketing logic.
- **Auto-LOANED on transfer**: yes, for both STUDENT and PARTNER.
- **`notes` field**: yes, add now as part of the User migration.
- **Admin UI surface**: extend existing UsersPanel; no new tab.
