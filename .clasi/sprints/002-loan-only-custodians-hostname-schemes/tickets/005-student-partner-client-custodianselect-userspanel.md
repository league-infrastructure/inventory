---
id: '005'
title: "Student/Partner client \u2014 CustodianSelect & UsersPanel"
status: in-progress
use-cases:
- SUC-001
- SUC-002
depends-on:
- '001'
- '003'
github-issue: ''
issue: add-student-and-partner-user-roles-for-loan-only-custodians.md
completes_issue: true
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Student/Partner client — CustodianSelect & UsersPanel

## Description

Build the `<CustodianSelect>` shared component that renders users as
staff-then-divider-then-loanees, replace the four existing inline custodian
selects with it, update `roles.ts` with STUDENT and PARTNER labels/styles, and
extend UsersPanel to support creating/editing loan-only users.

This ticket completes the student/partner issue. It depends on ticket 001
(schema + server) so that `role` is present on `/auth/users` responses and the
admin endpoints accept STUDENT/PARTNER. It depends on ticket 003 (auto-LOANED)
to be complete before this ticket is marked done, but client work can begin once
ticket 001 is in place.

## Acceptance Criteria

- [x] `client/src/lib/roles.ts` includes `STUDENT` and `PARTNER` in
      `USER_ROLES`, `ROLE_LABELS`, and `ROLE_BADGE_STYLES`.
- [x] `client/src/components/CustodianSelect.tsx` exists and:
      - Accepts props: `users: UserRecord[]`, `value: number | null`,
        `onChange: (id: number | null) => void`, and any needed `className` /
        `disabled` passthrough.
      - Renders a native `<select>` with staff users alphabetically first, then
        a `<option disabled>──────</option>` divider, then STUDENT/PARTNER users
        alphabetically.
      - Does not fetch users internally — caller provides the list.
      - Selecting a user calls `onChange(user.id)`; selecting the blank option
        calls `onChange(null)`.
- [x] `client/src/pages/computers/ComputerDetail.tsx` (lines 434–440): replaces
      the inline custodian `<select>` with `<CustodianSelect>`.
- [x] `client/src/components/TransferModal.tsx` (lines 64–73): replaces the
      inline custodian `<select>` with `<CustodianSelect>`.
- [x] `client/src/pages/kits/KitDetail.tsx` (lines 1024–1033): replaces the
      inline custodian `<select>` with `<CustodianSelect>`.
- [x] `client/src/pages/qr/actions/TransferAction.tsx` (lines 166–177): replaces
      the inline custodian `<select>` with `<CustodianSelect>`.
- [x] All four picker locations render the staff/divider/loanees layout when
      STUDENT or PARTNER users exist.
- [x] `client/src/pages/admin/UsersPanel.tsx`:
      - Role dropdown includes STUDENT and PARTNER.
      - Email field shows as optional when role is STUDENT or PARTNER (label
        change, no `required` attribute, no client-side validation error for
        blank email when role is loanee type).
      - Notes textarea is visible and editable for all users; prominently
        labeled for STUDENT/PARTNER (e.g. "Notes (contact info, partner org)").
      - Creating/editing a STUDENT with no email succeeds end-to-end.
- [x] `npx tsc --noEmit` clean in `client/`.
- [x] `npm run test:client` passes (no test files — pre-existing).
- [x] End-to-end verification (SUC-001, SUC-002): admin creates a STUDENT user
      with no email; STUDENT appears in all four pickers below the divider;
      assigning the computer to STUDENT sets `disposition = LOANED`.

## Implementation Plan

### Approach

1. Update `roles.ts` first (no dependencies).
2. Create `CustodianSelect.tsx`.
3. Update the four picker locations one at a time (each is a ~10-line swap).
4. Extend UsersPanel last (most complex UI change).

### Files to Create

- `client/src/components/CustodianSelect.tsx`

### Files to Modify

**`client/src/lib/roles.ts`**
- Add `'STUDENT'` and `'PARTNER'` to `USER_ROLES`.
- Add entries to `ROLE_LABELS`: e.g. `STUDENT: 'Student'`,
  `PARTNER: 'Partner'`.
- Add entries to `ROLE_BADGE_STYLES`: use a visually distinct colour from staff
  roles (e.g. a muted purple or yellow badge).

**`client/src/components/CustodianSelect.tsx` (new)**
- Props: `users: UserRecord[]`, `value: number | null | undefined`,
  `onChange: (id: number | null) => void`, optional `className`, `disabled`.
- Implementation:
  ```typescript
  const staffRoles = new Set(['CUSTODIAN', 'INSTRUCTOR', 'QUARTERMASTER', 'ADMIN']);
  const staff = users.filter(u => staffRoles.has(u.role)).sort(byName);
  const loanees = users.filter(u => !staffRoles.has(u.role)).sort(byName);
  // render: blank option, staff options, disabled divider option, loanee options
  ```
- The `UserRecord` type (from contracts) must include `role` after ticket 001.

**Four picker locations** — in each, find the inline `<select>` for custodian,
import `CustodianSelect`, and replace the `<select>` with
`<CustodianSelect users={users} value={custodianId} onChange={setCustodianId} />`.
The `users` state is already fetched in each location from `/auth/users`.

- `client/src/pages/computers/ComputerDetail.tsx` (~lines 434–440)
- `client/src/components/TransferModal.tsx` (~lines 64–73)
- `client/src/pages/kits/KitDetail.tsx` (~lines 1024–1033)
- `client/src/pages/qr/actions/TransferAction.tsx` (~lines 166–177)

**`client/src/pages/admin/UsersPanel.tsx`**
- Role dropdown: add STUDENT and PARTNER options (sourced from `ROLE_LABELS`).
- Email field: when selected role is STUDENT or PARTNER, remove `required`
  attribute and add "(optional)" to the label.
- Notes textarea: add a `<textarea>` field bound to a `notes` state variable.
  Label: "Notes". For STUDENT/PARTNER show a placeholder like "Parent contact,
  partner org, etc.". Include `notes` in the POST/PUT payload.
- Display `notes` in the user list row or detail if the panel currently shows
  user details inline.

### Testing Plan

1. `npx tsc --noEmit` in `client/` — clean.
2. `npm run test:client`.
3. Manual end-to-end test (matches SUC-001 and SUC-002 verification steps from
   the issue):
   - Admin → UsersPanel → Add user → role = STUDENT, no email, displayName =
     "Alice Test", notes = "parent: test@example.com" → Save → row appears.
   - Open ComputerDetail → custodian dropdown: staff first, divider, "Alice
     Test" below divider.
   - Assign computer to Alice → transfer recorded; `disposition = LOANED`.
   - Repeat picker check in TransferModal, KitDetail, and TransferAction.

### Documentation Updates

None required.
