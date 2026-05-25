---
status: final
---
<!-- CLASI: Before changing code or making plans, review the SE process in CLAUDE.md -->

# Sprint 002 Use Cases

---

## SUC-001: Admin creates a loan-only custodian

- **Actor**: Admin
- **Preconditions**: Admin is logged in; UsersPanel is open.
- **Main Flow**:
  1. Admin clicks "Add user" in UsersPanel.
  2. Admin selects role = STUDENT or PARTNER.
  3. Admin fills in displayName; leaves email blank.
  4. Admin optionally fills in notes (e.g. parent contact info, partner org).
  5. Admin saves. The new user row appears in the list.
- **Postconditions**: A User record with STUDENT or PARTNER role exists; email
  is NULL; notes is stored as provided.
- **Acceptance Criteria**:
  - [ ] UsersPanel role dropdown includes STUDENT and PARTNER.
  - [ ] Email field is optional (not required) when role is STUDENT or PARTNER.
  - [ ] Notes textarea is present for all users; visible and editable.
  - [ ] Save succeeds with null email; created row appears immediately.

---

## SUC-002: Admin assigns equipment to a loan-only custodian

- **Actor**: Admin / Quartermaster
- **Preconditions**: A STUDENT or PARTNER user exists; a Computer is available.
- **Main Flow**:
  1. User opens a Computer detail page (or uses TransferModal / KitDetail /
     QR TransferAction).
  2. The custodian picker shows staff users alphabetically, then a visual
     divider, then STUDENT/PARTNER users alphabetically.
  3. User selects a STUDENT or PARTNER from the picker and saves.
  4. The transfer is recorded; Computer.disposition is set to LOANED.
- **Postconditions**: Computer.custodianId = selected user; Computer.disposition
  = LOANED; a Transfer log entry is created.
- **Acceptance Criteria**:
  - [ ] All four custodian pickers (ComputerDetail, TransferModal, KitDetail,
        QR TransferAction) show the staff/divider/loanees layout.
  - [ ] Selecting a STUDENT or PARTNER and saving succeeds.
  - [ ] Computer.disposition is LOANED after transfer.
  - [ ] Transfer history reflects the correct custodian name.

---

## SUC-003: System blocks STUDENT/PARTNER from logging in

- **Actor**: User with STUDENT or PARTNER role attempting Google OAuth
- **Preconditions**: A User record with STUDENT or PARTNER role exists; the
  user somehow initiates a Google login.
- **Main Flow**:
  1. User completes Google OAuth flow.
  2. The OAuth callback looks up the matching User record.
  3. System detects STUDENT or PARTNER role and rejects the session.
  4. User is redirected to an access-denied page.
- **Postconditions**: No session is established; no cookie is set.
- **Acceptance Criteria**:
  - [ ] OAuth callback rejects STUDENT/PARTNER and does not create a session.
  - [ ] `requireAuth` middleware also rejects any STUDENT/PARTNER session as a
        belt-and-suspenders guard.

---

## SUC-004: Nullable email does not break existing UI surfaces

- **Actor**: Any logged-in user viewing admin or account pages
- **Preconditions**: At least one STUDENT/PARTNER user with null email exists.
- **Main Flow**:
  1. User navigates to /admin/users, /account, /admin/tokens, or views the
     app header.
  2. All surfaces that previously displayed email fall back gracefully when
     email is null.
- **Postconditions**: No visible null/undefined leaks; display shows "—" or
  equivalent fallback.
- **Acceptance Criteria**:
  - [ ] All identified display sites show a fallback (not "null"/"undefined")
        when email is absent.

---

## SUC-005: MCP agent sets scheme on a HostName record

- **Actor**: MCP agent (LLM client using inventory MCP server)
- **Preconditions**: HostName records exist without a scheme value.
- **Main Flow**:
  1. MCP agent calls `update_hostname({ id, scheme: "computer scientists" })`.
  2. The server persists the scheme value.
  3. MCP agent calls `create_hostname({ name: "Phong", scheme: "computer graphics terms" })`.
  4. The new record is created with scheme set.
- **Postconditions**: HostName records carry scheme values.
- **Acceptance Criteria**:
  - [ ] `update_hostname` accepts `scheme` parameter and persists it.
  - [ ] `create_hostname` accepts `scheme` parameter and persists it.
  - [ ] `GET /api/hostnames/schemes` returns distinct non-null scheme values.

---

## SUC-006: User filters hostnames list by scheme

- **Actor**: Admin / Quartermaster browsing the hostnames list
- **Preconditions**: HostName records with different scheme values exist.
- **Main Flow**:
  1. User opens the hostnames list page.
  2. The Scheme column is visible and sortable.
  3. User clicks the search icon on the Scheme column header.
  4. A dropdown of distinct scheme values appears (not a text input).
  5. User selects a scheme; the list narrows to matching rows.
- **Postconditions**: Only rows with the selected scheme are displayed.
- **Acceptance Criteria**:
  - [ ] Scheme column is present and sortable.
  - [ ] Scheme search icon reveals a `<select>` dropdown of distinct values.
  - [ ] Selecting a scheme filters the list correctly.

---

## SUC-007: User filters hostnames list by status

- **Actor**: Admin / Quartermaster browsing the hostnames list
- **Preconditions**: Both assigned and available HostName records exist.
- **Main Flow**:
  1. User clicks the search icon on the Status column header.
  2. A dropdown shows "Assigned" and "Available".
  3. User selects "Available"; the list narrows to unassigned hostnames.
- **Postconditions**: Only rows matching the selected status are displayed.
- **Acceptance Criteria**:
  - [ ] Status search icon reveals a `<select>` with "Assigned" and "Available".
  - [ ] Selecting a status filters the list correctly.

---

## SUC-008: User edits HostName scheme inline

- **Actor**: Admin / Quartermaster
- **Preconditions**: The hostnames list is open; at least one HostName exists.
- **Main Flow**:
  1. User clicks a hostname row to enter edit mode.
  2. Both a name input and a scheme input appear.
  3. The scheme input shows a `<datalist>` of existing scheme values for
     type-ahead.
  4. User types or selects a scheme value and presses Enter.
  5. The record updates and the row exits edit mode.
- **Postconditions**: HostName.scheme is updated; the list reflects the change.
- **Acceptance Criteria**:
  - [ ] Inline edit mode shows name and scheme inputs.
  - [ ] Scheme input provides datalist autocomplete from `GET /api/hostnames/schemes`.
  - [ ] Saving persists the scheme value via `PUT /api/hostnames/:id`.
