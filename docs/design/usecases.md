# JTL Inventory — Use Cases

> Extracted from `specification.md`, reverse-engineered from version
> `0.20260721.1` (2026-07-21). IDs are stable references for future
> planning documents — do not renumber existing entries.

---

### UC-001: Instructor Signs In with Google

- **Actor:** Instructor (new or returning)
- **Preconditions:** User has a `jointheleague.org` Google Workspace account.
- **Main Flow:**
  1. User clicks "Sign in with Google" on the Landing page.
  2. Google OAuth consent completes; server receives the profile.
  3. Server verifies the account's domain is `jointheleague.org`.
  4. Server looks up the user by `googleId`, then by `email`; creates a
     new `User` row (role `INSTRUCTOR`) if none exists.
  5. Server evaluates `QuartermasterPattern` rows against the user's
     email; promotes to `QUARTERMASTER` on a match (see UC-002).
  6. Session is established; user lands on the role-appropriate Dashboard.
- **Postconditions:** Authenticated session exists; user's role reflects
  the current pattern set.
- **Error Flows:** Non-`jointheleague.org` account → rejected at the
  domain check. `STUDENT`/`PARTNER`-role accounts → rejected (403) even
  if they somehow reach the callback.

---

### UC-002: User Is Auto-Promoted to Quartermaster

- **Actor:** System (triggered by any Google login)
- **Preconditions:** At least one `QuartermasterPattern` exists.
- **Main Flow:**
  1. On every Google login where the user's current role is not `ADMIN`,
     the server tests the user's email against each pattern (exact
     string, case-insensitive, or regex).
  2. First match found → role set to `QUARTERMASTER`.
  3. No match → role set to `INSTRUCTOR`.
  4. If the resolved role differs from the stored role, the DB is updated.
- **Postconditions:** Role reflects the current pattern set as of this login.
- **Error Flows:** None surfaced to the user — this runs silently.
  Note: a manually-set `CUSTODIAN` role is not protected from this
  re-evaluation and can be overwritten on next login.

---

### UC-003: Admin Logs into the Admin Console

- **Actor:** Admin
- **Preconditions:** `ADMIN_PASSWORD` env var is configured.
- **Main Flow:**
  1. Admin navigates to `/admin`, enters the password.
  2. Server compares it to `ADMIN_PASSWORD` via constant-time comparison.
  3. On success, `req.session.isAdmin = true` is set on the existing
     session/cookie; Admin is redirected into the console.
- **Postconditions:** Admin console routes are accessible for this session.
- **Error Flows:** Wrong password → 401. Missing password field → 400.
  `ADMIN_PASSWORD` unset → 503 (console effectively disabled). A
  Google-authenticated user already flagged `ADMIN` skips this flow
  entirely and passes the same gate.

---

### UC-004: Instructor Checks Out a Kit to Themselves

- **Actor:** Instructor
- **Preconditions:** Kit exists, `status: ACTIVE`.
- **Main Flow:**
  1. Instructor opens the kit (via list, detail page, or QR scan) and
     chooses "Transfer."
  2. Instructor selects themselves as custodian (and optionally a
     destination site).
  3. `POST /transfers` records the change; the kit's `custodianId`
     (and `siteId`, if given) update; every computer in the kit is
     cascaded to the same custodian/site.
  4. A `Transfer` row and a parallel `AuditLog` entry are written.
- **Postconditions:** Kit shows as "checked out" (non-null custodian) on
  the Checked-Out list and in `GET /transfers/out`.
- **Error Flows:** Kit is `RETIRED` → 400 "Kit is not active." Given
  `siteId` inactive or nonexistent → 400. Given `custodianId` nonexistent
  → 400.

---

### UC-005: Instructor Checks a Kit Back In

- **Actor:** Instructor
- **Preconditions:** Kit currently has a non-null custodian.
- **Main Flow:**
  1. Instructor opens the kit and chooses "Transfer" / "Check In."
  2. Instructor clears the custodian (or the system defaults to "Admin")
     and/or sets a return site.
  3. `POST /transfers` records the change; member computers cascade.
- **Postconditions:** Kit's custodian is null; it disappears from the
  "checked out" view.
- **Error Flows:** Same validation as UC-004 (active site required if given).

---

### UC-006: Quartermaster Transfers a Standalone Computer

- **Actor:** Quartermaster
- **Preconditions:** Computer exists and is **not** currently assigned to
  a kit.
- **Main Flow:**
  1. Quartermaster opens the computer detail page, chooses "Transfer."
  2. Selects a new custodian and/or site.
  3. `POST /transfers` applies the change; if the new custodian's role is
     `STUDENT` or `PARTNER`, the computer's `disposition` auto-sets to
     `LOANED`.
- **Postconditions:** Computer's custodian/site updated; disposition
  reflects loan status if applicable.
- **Error Flows:** None beyond standard validation (site must be active,
  custodian must exist).

---

### UC-007: Attempt to Transfer a Computer That Is In a Kit

- **Actor:** Any authenticated user
- **Preconditions:** Computer's `kitId` is set.
- **Main Flow:**
  1. User attempts to open the transfer action for the computer.
  2. Client hides the transfer button once it detects the computer
     belongs to a kit; if the request is made anyway,
     `POST /transfers` rejects it.
- **Postconditions:** No change made.
- **Error Flows:** 400 "Computer is in a kit — transfer the kit instead."

---

### UC-008: Quartermaster Creates a New Kit

- **Actor:** Quartermaster
- **Preconditions:** A unique kit number and an active site are chosen.
- **Main Flow:**
  1. Quartermaster fills the Kit form: number, name, container type,
     site, optional description/category.
  2. `POST /kits` validates uniqueness of `number`, that `siteId`
     references an active site, and creates the row.
  3. Server auto-assigns `qrCode = /k/{id}`.
- **Postconditions:** Kit appears in `GET /kits`; label can be printed
  (UC-017).
- **Error Flows:** Duplicate number → 400. Missing/empty name → 400.
  Inactive or missing site → 400.

---

### UC-009: Quartermaster Adds a Pack with Auto-Parsed Items

- **Actor:** Quartermaster
- **Preconditions:** Kit exists.
- **Main Flow:**
  1. Quartermaster adds a pack under a kit, typing a free-text
     description (e.g. "5 Edison robots, chargers, and cables") instead
     of picking a template.
  2. `POST /kits/:kitId/packs` parses the description, extracting
     quantity + item name segments, classifying each as `COUNTED` or
     `CONSUMABLE`, and fuzzy-matching against existing item names in the
     kit to avoid near-duplicates.
  3. Matched/created `Item` rows are attached to the new pack.
- **Postconditions:** Pack exists with auto-populated items; a `qrCode`
  (`/p/{id}`) is assigned.
- **Error Flows:** Segments without a detected quantity are silently
  dropped (not created as items) — no error surfaced, but the resulting
  item list may be incomplete relative to the typed description.

---

### UC-010: Quartermaster Clones an Existing Kit

- **Actor:** Quartermaster
- **Preconditions:** Source kit exists.
- **Main Flow:**
  1. Quartermaster selects "Clone" on a kit.
  2. `POST /kits/:id/clone` deep-copies the kit, its packs, and their
     items into a new kit named `"{name} (Copy)"`, with the next
     available `number`.
- **Postconditions:** New kit exists, `ACTIVE`, unassigned (no
  custodian, no computers), same site as the source.
- **Error Flows:** Nonexistent source kit → 404.

---

### UC-011: Quartermaster Retires a Kit

- **Actor:** Quartermaster
- **Preconditions:** Kit is currently `ACTIVE`.
- **Main Flow:**
  1. Quartermaster chooses "Retire" on the kit.
  2. `PATCH /kits/:id/retire` sets `status: RETIRED`; audit entry written.
- **Postconditions:** Kit moves to the Retired Kits list; excluded from
  the default active-kits view.
- **Error Flows:** Retiring an already-retired kit → 400 (no silent
  no-op). Restoring uses a generic `PUT {status: 'ACTIVE'}` from the
  Retired Kits page — there is no dedicated "un-retire" endpoint.

---

### UC-012: Quartermaster Creates a Computer Record

- **Actor:** Quartermaster
- **Preconditions:** At least one of serial number, service tag, or
  model is known.
- **Main Flow:**
  1. Quartermaster fills the Computer form.
  2. `POST /computers` validates at least one identifying field is
     present, defaults `disposition` to `ACTIVE`, defaults student
     credentials to `'student'`/`'student'` if omitted, and auto-attaches
     a matching image by serial number if one exists.
  3. Server auto-assigns `qrCode = /c/{id}`.
- **Postconditions:** Computer appears in `GET /computers`.
- **Error Flows:** No identifying field → 400. Invalid `disposition`,
  `siteId`, `kitId`, `osId`, or `manufacturerId` → 400.

---

### UC-013: Quartermaster Assigns a Host Name to a Computer

- **Actor:** Quartermaster
- **Preconditions:** A free (unassigned) host name exists, or a new one
  is created first.
- **Main Flow:**
  1. Quartermaster edits the computer, selecting a `hostNameId`.
  2. `PUT /computers/:id` unassigns any previously-linked host name
     (clearing its `computerId`) and assigns the new one; the change is
     audited.
- **Postconditions:** Host name shows as assigned in `HostNameList`.
- **Error Flows:** N/A directly on the computer side; deleting a host
  name that is still assigned is blocked (400) from the Hostname side.

---

### UC-014: Instructor Performs a Kit Inventory Check

- **Actor:** Instructor
- **Preconditions:** Kit exists with at least one pack/item or computer.
- **Main Flow:**
  1. Instructor starts a check from the Kit Detail page or the Kit List
     quick-check modal.
  2. `POST /inventory-checks/kit/:kitId` creates one line per item across
     all packs (expected = quantity for `COUNTED`, `'present'` otherwise)
     plus one line per assigned computer (`'present'`).
  3. Instructor enters actual values/notes per line.
  4. `PATCH /inventory-checks/:id` submits: each line's actual value is
     string-compared to its expected value to set `hasDiscrepancy`;
     computer lines marked present update that computer's
     `lastInventoried`.
- **Postconditions:** Check appears in the kit's history with a computed
  `discrepancyCount`; kit's `lastInventoried` (computed from most recent
  check) reflects this check.
- **Error Flows:** Nonexistent kit → 404 "Kit not found." No numeric
  tolerance exists — an off-by-one count is recorded as a discrepancy
  the same as a completely missing item.

---

### UC-015: Instructor Reports a Typed Issue

- **Actor:** Instructor
- **Preconditions:** A kit, pack, item, or computer exists to attach the
  issue to.
- **Main Flow:**
  1. Instructor opens the desktop "Report Issue" modal from a kit/pack/
     computer detail page, selects a type (`MISSING_ITEM`,
     `REPLENISHMENT`, `DAMAGE`, `MAINTENANCE`, `OTHER`), and adds notes.
  2. `POST /issues` validates the type and that any given `itemId`
     belongs to the given `packId`; creates the issue with `status: OPEN`.
- **Postconditions:** Issue appears in the Issues list and in the
  object's Issues panel.
- **Error Flows:** Invalid type → 400. Item/pack mismatch → 400. No
  target entity given → 400.

---

### UC-016: Quartermaster Resolves an Issue

- **Actor:** Quartermaster (or any non-loanee authenticated user — not
  QM-restricted)
- **Preconditions:** Issue exists with `status: OPEN`.
- **Main Flow:**
  1. User selects "Resolve" on the issue, optionally adding/overwriting
     notes.
  2. `PATCH /issues/:id/resolve` sets `status: RESOLVED`, records
     resolver + `resolvedAt`.
- **Postconditions:** Issue moves out of the default OPEN filter.
- **Error Flows:** Resolving an already-resolved issue → 400 (issues are
  terminal — no re-open path exists).

---

### UC-017: User Scans a QR Label to Report a Quick Issue

- **Actor:** Any signed-in, non-loanee user
- **Preconditions:** A physical kit/pack/computer label with a printed
  QR code exists.
- **Main Flow:**
  1. User scans the label, landing on `/qr/k|p|c/:id`.
  2. If unauthenticated, user signs in via Google (`useQrAuth` gate).
  3. User taps "Report Issue" and types free text.
  4. `POST /notes` creates a Note attached to the object.
- **Postconditions:** A Note is visible on the object's Notes list.
- **Error Flows:** **Note — this does *not* create a typed `Issue`
  record** (see UC-015/UC-016); it will not appear in the Issues list or
  filters, a real behavioral gap between the two "report issue" entry
  points in the UI.

---

### UC-018: Quartermaster Prints Kit and Pack Labels

- **Actor:** Quartermaster
- **Preconditions:** Kit (and optionally its packs) exist.
- **Main Flow:**
  1. Quartermaster opens the kit detail page and chooses "Print Labels,"
     selecting which packs to include.
  2. `POST /labels/kit/:id/batch-pdf` generates a multi-page PDF: kit
     label (number = `kit.number`, QR → `/qr/k/{id}`) followed by each
     selected pack label (number = `kitNumber/sequence`, QR →
     `/qr/p/{id}`).
  3. Quartermaster prints to Dymo 59×102mm label stock.
- **Postconditions:** Physical labels produced.
- **Error Flows:** Nonexistent kit/pack id → `NotFoundError`. Empty
  computer-id list for the batch computer-label endpoint → 400 "No
  computer IDs provided."

---

### UC-019: User Scans a Legacy Short-URL QR Code

- **Actor:** Any user (authenticated or anonymous)
- **Preconditions:** An older-style `/k/:id`, `/p/:id`, or `/c/:id` QR
  code (or manually-typed short URL) is used.
- **Main Flow:**
  1. Signed-in user is immediately redirected to the full desktop detail
     page for the object.
  2. Anonymous user instead sees a minimal info card (object type + name,
     via the public `GET /qr/k|p|c/:id` endpoint) with a Google
     sign-in link that returns them to the detail page after login.
- **Postconditions:** User reaches the detail page (if signed in) or a
  sign-in prompt (if not).
- **Error Flows:** Nonexistent id → 404 from the info endpoint.

---

### UC-020: User Searches the Catalog

- **Actor:** Any authenticated non-loanee user
- **Preconditions:** None.
- **Main Flow:**
  1. User types 2+ characters (or a bare number for a kit-number
     shortcut) into the search box in the app shell.
  2. `GET /search?q=...` fans out across Kits, Packs, Items, Computers,
     Sites, Users, Host Names, Categories, Manufacturers via
     case-insensitive substring match.
  3. Results are grouped by type in the dropdown; each links to its
     detail (or list) page.
- **Postconditions:** None (read-only).
- **Error Flows:** Query under 2 characters (non-numeric) → no search
  performed.

---

### UC-021: Quartermaster Reviews the Audit Log

- **Actor:** Quartermaster
- **Preconditions:** None.
- **Main Flow:**
  1. Quartermaster opens Reports → Audit Log.
  2. Filters by object type, object id, user, field, or date range.
  3. `GET /reports/audit-log` returns a paginated result (max 200/page).
- **Postconditions:** None (read-only).
- **Error Flows:** None significant; empty filters return the full log,
  paginated.

---

### UC-022: Quartermaster Reviews the Inventory Age Report

- **Actor:** Quartermaster
- **Preconditions:** At least one active kit or active computer exists.
- **Main Flow:**
  1. Quartermaster opens Reports → Inventory Age.
  2. `GET /reports/inventory-age` returns every active kit/computer with
     days-since-last-check, sorted never-checked-first then
     oldest-first.
  3. Client color-codes rows (green ≤30d, yellow ≤90d, red >90d/never).
- **Postconditions:** None (read-only); informs which kits/computers
  need a physical check (UC-014).
- **Error Flows:** None.

---

### UC-023: Quartermaster Imports Computers via CSV

- **Actor:** Quartermaster
- **Preconditions:** A CSV file with a header row containing at least
  `Host Name`, `Serial Number`, `Disposition`.
- **Main Flow:**
  1. Quartermaster uploads the CSV to the admin Import/Export panel,
     choosing match-by (host name or serial number).
  2. `POST /import/computers-csv/preview` parses rows, resolves
     Site/Kit/OS/Custodian/Category names to ids, and returns a diff for
     review.
  3. Quartermaster reviews and confirms.
  4. `POST /import/computers-csv/apply` applies each row in sequence,
     auto-creating unresolved host names, collecting per-row errors
     without stopping the batch.
- **Postconditions:** Matched computers updated / new ones created;
  errors (if any) reported per row.
- **Error Flows:** Unresolvable name references (e.g. unknown site) are
  soft errors — the row still applies with whatever did resolve, the
  unresolved reference is reported but does not block the row. The
  operation is not transactional/atomic across rows.

---

### UC-024: Quartermaster Exports the Full Inventory

- **Actor:** Quartermaster
- **Preconditions:** None.
- **Main Flow:**
  1. Quartermaster opens Import/Export and chooses Export.
  2. `GET /export` (Excel) or `GET /export/json` returns
     Sites/Kits/Packs/Items/Computers as a downloadable file, with a
     `_metadata`/version stamp.
- **Postconditions:** File downloaded.
- **Error Flows:** None significant beyond standard auth failures.

---

### UC-025: Admin Manages Quartermaster Auto-Promotion Patterns

- **Actor:** Admin (or Quartermaster, via the little-used direct API)
- **Preconditions:** None.
- **Main Flow:**
  1. Admin opens the Permissions panel, adds a pattern (exact email or
     regex) that should auto-grant `QUARTERMASTER`.
  2. `POST /admin/quartermasters` validates the regex compiles (if
     `isRegex`) and rejects an exact duplicate pattern.
- **Postconditions:** Any future/next Google login matching the pattern
  is promoted (UC-002).
- **Error Flows:** Duplicate pattern → 400. Invalid regex → 400.

---

### UC-026: Admin Restores a Soft-Deleted Kit from Trash

- **Actor:** Admin
- **Preconditions:** A kit was previously soft-deleted (`DELETE
  /kits/:id`).
- **Main Flow:**
  1. Admin opens the Trash panel, Kits tab.
  2. `GET /kits/deleted` lists soft-deleted kits.
  3. Admin clicks Restore; `POST /kits/:id/restore` clears `deletedAt`.
- **Postconditions:** Kit reappears in the normal Kit list.
- **Error Flows:** Restoring a kit that isn't currently deleted → 400
  no-op guard. (The same flow applies symmetrically to Computers; note
  Manufacturers have no restore endpoint at all despite having the same
  `deletedAt` column — see specification Open Questions.)

---

### UC-027: Admin Configures an Integration Credential

- **Actor:** Admin
- **Preconditions:** None.
- **Main Flow:**
  1. Admin opens the Configuration panel.
  2. Admin enters a value for one of the 10 fixed keys (e.g. Anthropic
     API key) where no env var is already set.
  3. `PUT /admin/config` upserts the `Config` row and refreshes the
     in-memory cache.
- **Postconditions:** The new value takes effect immediately for
  DB-sourced config; a "restart required" badge appears if the key is
  read only at process start.
- **Error Flows:** If the corresponding env var is already set, it wins
  regardless of the DB value — the panel shows the source but the
  DB-entered value is effectively ignored until the env var is removed.

---

### UC-028: Admin Runs a Manual Database Backup

- **Actor:** Admin
- **Preconditions:** `pg_dump` available (or Docker fallback in dev).
- **Main Flow:**
  1. Admin opens the Scheduled Jobs panel (or a dedicated ad-hoc backup
     control) and triggers "Run Now" on `daily-backup`/`weekly-backup`,
     or an ad-hoc backup.
  2. `BackupRotationService` runs `pg_dump --format=custom`, stores the
     dump locally and uploads it to DigitalOcean Spaces, applying the
     rotation policy (daily overwrites same weekday slot; weekly keeps
     last 4).
- **Postconditions:** New backup file present locally and in Spaces;
  `ScheduledJob.lastRunAt` updated.
- **Error Flows:** `lastError` is recorded on the job row if the dump
  fails; scheduled (non-ad-hoc) backups cannot be deleted through the API.

---

### UC-029: User Chats with the AI Assistant to Find a Kit

- **Actor:** Any authenticated non-loanee user
- **Preconditions:** `ANTHROPIC_API_KEY` is configured.
- **Main Flow:**
  1. User asks a natural-language question in the AI chat panel (e.g.
     "where is the robotics kit for Lincoln site?").
  2. A cheap screening call rejects off-topic messages.
  3. The main chat loop (Claude, tool-use enabled) calls `list_kits`/
     `get_kit`-equivalent service functions filtered by the user's
     role-appropriate tool list, and responds in natural language.
- **Postconditions:** None persisted server-side for web chat (history
  is client-held); any write action taken (e.g., a transfer requested in
  chat) is audited with `source: MCP`.
- **Error Flows:** Off-topic message → screened out, generic decline
  response. Feature globally disabled (no API key) → chat UI reports
  unavailable via `GET /ai/status`.

---

### UC-030: Slack User Checks a Kit's Location via Slash Command

- **Actor:** Instructor or Quartermaster with a Slack account matching
  their inventory email or display name
- **Preconditions:** Slack app installed in the workspace; user has
  signed into the web app at least once (for email/name matching).
- **Main Flow:**
  1. User runs `/whereis <kit name or number>` in Slack.
  2. Server verifies the Slack request signature (HMAC, 5-minute replay
     window), resolves the Slack user to an inventory `User`.
  3. Hand-coded lookup queries the kit and formats its current site/
     custodian into a Slack message, posted back via `chat.postMessage`.
- **Postconditions:** None (read-only).
- **Error Flows:** Unresolvable Slack user (no matching email/display
  name) → told to sign into the web app first. Invalid/stale signature
  → request rejected before any lookup runs.
