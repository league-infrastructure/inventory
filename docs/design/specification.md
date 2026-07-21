# JTL Inventory — Feature Specification (As Built)

> **Reverse-engineered from the implementation as of version
> `0.20260721.1` (2026-07-21).** There is no stakeholder-authored
> specification for this project — per stakeholder instruction, this
> document derives entirely from reading `server/prisma/schema.prisma`,
> the route/service layers, the client, and the test suite. It describes
> what the code *does*, not what was originally envisioned. Where the
> intended behavior is ambiguous or the code and its own documentation
> disagree, that is flagged explicitly rather than resolved by guessing —
> see **Open Questions** at the end.

All API routes are prefixed `/api`. Route paths below omit that prefix
for brevity (e.g. "`GET /kits`" means "`GET /api/kits`").

---

## 1. Authentication & Roles

### 1.1 Sign-in paths

- **Google OAuth** (`server/src/routes/auth.ts`) — Passport `GoogleStrategy`
  restricted to Google Workspace domain `jointheleague.org` (`hd` param
  plus a defense-in-depth check that the returned email ends with
  `@jointheleague.org`). On login the user is looked up by `googleId` then
  by `email`, and created if new.
- **Admin password** (`server/src/routes/admin/auth.ts`) — a completely
  separate mechanism. `POST /admin/login` compares the posted password to
  the `ADMIN_PASSWORD` env var using `crypto.timingSafeEqual` (constant-time,
  but the password itself is plaintext in the env, not hashed). On success
  it sets `req.session.isAdmin = true` — the **same** Express session/cookie
  Passport uses, just a different boolean flag alongside it. A
  Google-authenticated user whose `role` is `ADMIN` also passes the admin
  gate without ever entering the password (`isAdmin OR role===ADMIN`).
  Missing `ADMIN_PASSWORD` → `503`; wrong password → `401`; missing body
  field → `400`.
- **Test-only bypass** (`server/src/routes/testAuth.ts`) — `POST
  /test/login` (role-selectable, for Supertest), `GET
  /auth/test-login?role=` (for Playwright, redirect-based; supports
  `role=first-instructor` to find the first real INSTRUCTOR row), `POST
  /test/admin-login`. The module throws at load time if `NODE_ENV ===
  'production'`, and `app.ts` only requires/mounts it when `NODE_ENV` is
  `test` or `e2e` — double-gated so it cannot exist in a production build.

### 1.2 Role model

Schema enum `UserRole`: `CUSTODIAN, INSTRUCTOR, QUARTERMASTER, ADMIN,
STUDENT, PARTNER`.

- **`INSTRUCTOR`** — default role for a new Google sign-in. Passes
  `requireAuth`.
- **`QUARTERMASTER`** — gates `requireQuartermaster` (all writes across
  the catalog, tokens, images, quartermaster-pattern CRUD).
- **`ADMIN`** — gates `requireAdmin` (bypasses the password check too).
- **`STUDENT` / `PARTNER`** (`LOANEE_ROLES`) — cannot sign in via Google at
  all (rejected post-authentication) and are rejected by `requireAuth`
  itself (403). They exist purely as **custodian records** — an admin can
  create a loanee "user" (email optional) to represent a student or
  partner org a kit/computer is on loan to.
- **`CUSTODIAN`** — a selectable label in the admin Users panel with **no
  distinct authorization behavior anywhere in the code** — it passes
  `requireAuth` exactly like `INSTRUCTOR` and gets no special treatment in
  `hasQMAccess`. Functionally vestigial as an authorization tier; it is
  only ever set manually.

### 1.3 Auto-promotion to Quartermaster

On **every** Google login (not just the first), if the user's current
role is not `ADMIN`, the server evaluates all `QuartermasterPattern` rows
against the user's email — exact case-insensitive match if `isRegex` is
false, `new RegExp(pattern, 'i').test(email)` if true — and sets the
role to `QUARTERMASTER` on a match, `INSTRUCTOR` otherwise, updating the
DB if it changed. **Note:** because the guard is only `role !== 'ADMIN'`,
a manually-set `CUSTODIAN` role is *not* protected from this
re-evaluation and can be silently overwritten back to `INSTRUCTOR`/
`QUARTERMASTER` on the user's next Google login.

Patterns are managed via two near-duplicate route sets:
- `/quartermasters/patterns` (`requireQuartermaster`) — full CRUD, but
  **not called from any client code** (orphaned API surface).
- `/admin/quartermasters` (`requireAdmin`) — identical CRUD, and the one
  actually used by the admin **Permissions** panel.

### 1.4 Error mapping

Service errors are typed (`server/src/services/errors.ts`) and mapped by a
generic Express error handler: `ValidationError` → 400, `NotFoundError` →
404, `ConflictError` → 409. In practice, "already exists" conditions are
inconsistently mapped across domains — Hostname uses `ConflictError`
(409), while Kit/Category/Manufacturer/Operating System name/number
collisions use `ValidationError` (400) for the same class of problem.
This is a real inconsistency in the codebase, not an intentional
distinction.

---

## 2. Sites

`server/src/routes/sites.ts`, `services/site.service.ts`.

- `GET /sites` — active sites only, home site first then alphabetical.
- `GET /sites/:id`, `POST /sites` (QM), `PUT /sites/:id` (QM).
- `PATCH /sites/:id/deactivate` (QM) — the only "removal" path; there is
  no hard delete and no restore endpoint for sites (unlike Kit/Computer).
- `POST /sites/:id/geocode` (QM) — re-geocode from the stored address.
- `POST /sites/nearest` — body `{latitude, longitude}` → nearest active,
  geocoded site by haversine distance (Earth radius 6371km), 2-decimal
  `distanceKm`; 404 if no site has coordinates.

Business rules:
- Only one site may have `isHomeSite: true` — setting it on any site
  unsets it on all others.
- Geocoding uses the public **OpenStreetMap Nominatim** API
  (`nominatim.openstreetmap.org/search`, custom User-Agent). On create/
  update, if an address is given without explicit coordinates, the
  service geocodes automatically; failures are swallowed (coordinates
  stay null, no error surfaced). Clearing the address clears coordinates.
- Deactivating an already-inactive site is a 400 no-op guard.
- Deactivated sites vanish from all site pickers but are still referenced
  by historical computers/kits/transfers (FK retained).

---

## 3. Catalog: Kits, Packs, Items

### 3.1 Kits (`routes/kits.ts`, `services/kit.service.ts`)

- `GET /kits` (optional `status` filter), `GET /kits/deleted` (admin,
  trash), `GET /kits/:id` (detail with packs/items/computers), `POST
  /kits` (QM), `PUT /kits/:id` (QM), `PATCH /kits/:id/retire` (QM),
  `POST /kits/:id/clone` (QM), `DELETE /kits/:id` / `restore` /
  `permanent` (admin, soft-delete lifecycle).
- **Numbering**: `kit.number` is a caller-supplied integer, checked
  unique on create/update (`ValidationError` 400 "Kit number X is already
  in use" — a genuine uniqueness conflict mapped to 400, not 409).
- **Container type**: enum `BAG | LARGE_TOTE | SMALL_TOTE | DUFFEL |
  PENCIL_BOX`, defaults to `BAG`.
- `siteId` must reference an **active** site.
- A `qrCode` (`/k/{id}`) is auto-assigned right after creation.
- **Retire**: `PATCH .../retire` sets `status: RETIRED`; 400 if already
  retired (no silent no-op). There is no dedicated "un-retire" route — the
  client restores a retired kit by issuing a generic `PUT` with
  `status: 'ACTIVE'`.
- **Custodian/site cascade**: changing a kit's `siteId`/`custodianId`
  cascades to every computer currently assigned to that kit.
- **Clone**: deep-copies the kit plus all packs and items into a new kit
  named `"{name} (Copy)"`, auto-assigning the next available `number`.
  Site is copied; custodian, status, and member computers are not — the
  clone starts unassigned and `ACTIVE`.
- **`lastInventoried`** on the kit list is computed from the most recent
  `InventoryCheck` row, not a stored column.
- Soft-delete/restore/permanent-delete follow a guarded state machine:
  400 if already in the target state; permanent delete requires the
  record to already be soft-deleted first.

### 3.2 Packs (`routes/packs.ts`, `services/pack.service.ts`)

- `GET /packs` (all), `GET /kits/:kitId/packs`, `GET /packs/:id`, `POST
  /kits/:kitId/packs` (QM), `PUT /packs/:id` (QM), `DELETE /packs/:id`
  (QM, hard delete — packs have no soft-delete/trash).
- A `qrCode` (`/p/{id}`) is auto-assigned right after creation.
- **Item population on create** — two mutually exclusive mechanisms:
  1. **Template cloning**: pass `templatePackId` to copy every item
     (name/type/expectedQuantity) verbatim from an existing pack.
  2. **Description parsing** (`description-parser.ts`, only if no
     template given and a `description` string is present): splits the
     text on commas/semicolons/"and", extracts leading numeric or
     word-number quantities (e.g. "5 Edison robots", "five micro:bit
     boards"; supports word numbers up to twenty), and classifies each
     as `CONSUMABLE` (name contains one of: batteries, cable ties, zip
     ties, tape, velcro, stickers, labels) or `COUNTED` otherwise.
     Segments without a detected quantity are dropped, not created as
     items. Parsed names are fuzzy-matched (stemmed, substring-based,
     similarity threshold 0.35) against existing item names across the
     kit to avoid near-duplicate item names.

### 3.3 Items (`routes/items.ts`, `services/item.service.ts`)

- `GET /items` (all), `GET /packs/:packId/items`, `POST
  /packs/:packId/items` (QM), `PUT /items/:id` (QM), `DELETE /items/:id`
  (QM, hard delete).
- `type` is `COUNTED` or `CONSUMABLE` (400 otherwise).
- `COUNTED` items require `expectedQuantity >= 1`; `CONSUMABLE` items
  always have `expectedQuantity: null`, regardless of input, and switching
  a `COUNTED` item to `CONSUMABLE` nulls out its quantity.
- No uniqueness constraint on item name within a pack.

---

## 4. Computers & Host Names

### 4.1 Computers (`routes/computers.ts`, `services/computer.service.ts`)

- `GET /computers` (filters: `disposition`, `siteId`, `kitId`,
  `unassigned=true`), `GET /computers/deleted` (admin), `GET
  /computers/:id`, `POST /computers` (QM), `PUT /computers/:id` (QM),
  `PATCH /computers/:id/disposition` (QM), `DELETE` / `restore` /
  `permanent` (admin, soft-delete lifecycle).
- Create requires at least one of `serialNumber`/`serviceTag`/`model`
  (400 otherwise, message matches `/identifying field/i`).
- `disposition` enum: `ACTIVE, LOANED, NEEDS_REPAIR, IN_REPAIR, SCRAPPED,
  LOST, DECOMMISSIONED` — defaults to `ACTIVE` on create. No enforced
  state-machine between values; any transition is allowed via the
  dedicated PATCH endpoint.
- **Manufacturer duality**: the schema carries both a deprecated
  free-text `manufacturer` string and a `manufacturerId` FK to the
  `Manufacturer` table, per a code comment ("pending cleanup migration —
  drop after manufacturerId backfill validated"). Both fields are
  accepted and stored independently on create/update with **no automatic
  sync** between them — a genuine, currently-unresolved data-model
  transition in progress.
- **Kit inheritance**: setting `kitId` forces the computer's `siteId` and
  `custodianId` to inherit from the kit, overriding any explicit values
  passed for those fields. Explicitly clearing `kitId` (`null`) lets
  `siteId`/`custodianId` be set independently again.
- `studentUsername`/`studentPassword` default to the literal string
  `'student'`/`'student'` if not supplied on create.
- A `qrCode` (`/c/{id}`) is auto-assigned right after creation.
- **Auto image match**: on create, if a `serialNumber` is given, the
  service searches the `Image` table for a `fileName` containing that
  serial (case-insensitive) and auto-attaches it if found — not exposed
  as an API parameter, a background convenience.
- Full audit trail on update (`serialNumber, serviceTag, model,
  adminUsername/Password, studentUsername/Password, disposition,
  dateReceived, lastInventoried, notes, siteId, kitId, osId, qrCode,
  manufacturerId`).

### 4.2 Host Names (`routes/hostnames.ts`, `services/hostname.service.ts`)

- `GET /hostnames`, `GET /hostnames/schemes` (distinct non-null `scheme`
  values, for a client autocomplete), `POST /hostnames` (QM), `PUT
  /hostnames/:id` (QM), `DELETE /hostnames/:id` (QM).
- **Host names are manually typed, not auto-generated from a naming
  scheme** — `scheme` is just a free-text categorization tag, not a
  generator template.
- Uniqueness is enforced in application code (`findFirst` before create/
  update) → `ConflictError` (409) "Host name already exists" — the one
  domain that does use 409 for this class of error.
- Deleting a hostname currently assigned to a computer is blocked (400) —
  it must be unassigned first.
- **Assignment happens from the Computer side**: a computer's
  `hostNameId` field sets/clears `HostName.computerId`; Hostname itself
  has no "assign" endpoint.
- Hostname **creation is not audited** despite `auditFields = ['name',
  'scheme']` being declared on the service — a minor inconsistency
  relative to every other entity's create-path auditing.

### 4.3 Categories, Manufacturers, Operating Systems

Three small reference-data domains (`categories.ts`, `manufacturers.ts`,
`operating-systems.ts` + matching services) with a shared pattern:
name-uniqueness enforced pre-create/update (400 "already exists" — not
409, unlike Hostname), and delete blocked (400, with a count message) if
any Kit/Computer still references the record.

- **Manufacturer** has a `deletedAt` soft-delete column, but **no
  restore/permanent-delete/trash-list route is exposed** — a delete is
  effectively irreversible via the API even though the column supports
  reversal, asymmetric with the Kit/Computer trash pattern.
- **Operating System** has an `update()` method in the service that is
  **not wired to any route** — no `PUT /operating-systems/:id` exists.

---

## 5. Custody & Transfers (Checkout / Check-in)

`server/src/routes/transfers.ts`, `services/transfer.service.ts`.

There is **no separate checkout/check-in concept** in this system. A
single `Transfer` model and endpoint captures every custody/location
change for a Kit or Computer; "checked out" simply means the object's
current `custodianId` is non-null.

- `POST /transfers` — the one mutation endpoint. Body: `{objectType:
  'Kit'|'Computer', objectId, custodianId?, siteId?, notes?, latitude?,
  longitude?}`.
- `GET /transfers/history/:objectType/:objectId` — full history,
  newest first.
- `GET /transfers/out` — everything currently "checked out": all
  `ACTIVE` kits with a non-null custodian, plus all computers with a
  non-null custodian that are **not** currently inside a kit.

Business rules:
- Kit transfer requires `status === 'ACTIVE'` (400 "Kit is not active"
  on a retired kit). A new `siteId`, if given, must be an active site; a
  new `custodianId`, if given, must exist.
- **Kit transfer cascades** to every computer currently in the kit —
  their `custodianId`/`siteId` are force-updated to match, bypassing the
  next rule (this is a bulk system update, not a per-computer Transfer).
- **A computer inside a kit cannot be individually transferred** — 400
  "Computer is in a kit — transfer the kit instead." The client hides
  the transfer button accordingly.
- **Auto-disposition on loan**: transferring a (kit-less) computer to a
  custodian whose role is `STUDENT` or `PARTNER` automatically sets the
  computer's `disposition` to `LOANED`. There is no equivalent for kits.
- `fromCustodian`/`toCustodian` are recorded as **denormalized display
  names** (`"Admin"` if custodian is null) at transfer time, preserving
  history even if the user's display name changes or the user is later
  deleted.
- Every transfer writes both a `Transfer` row *and* a parallel audit-log
  entry (`field: 'transfer'`) — two overlapping history mechanisms.
- `latitude`/`longitude` may be recorded per transfer (mobile
  geolocation capture) with no range validation.

---

## 6. Inventory Checks

`server/src/routes/inventory-checks.ts`, `services/inventory-check.service.ts`.

- `POST /inventory-checks/kit/:kitId` — starts a kit-level check:
  enumerates every `Item` across every `Pack` in the kit **plus** every
  `Computer` assigned to the kit as check lines.
- `POST /inventory-checks/pack/:packId` — pack-level check: only that
  pack's items (no computers).
- `PATCH /inventory-checks/:id` — submits the check: caller supplies
  `actualValue`/`notes` per line.
- `GET /inventory-checks/history/kit/:kitId` and `/history/pack/:packId`
  — past checks, newest first, each with line detail and a computed
  `discrepancyCount`.

Business rules:
- Expected value seeding: `COUNTED` items → `String(expectedQuantity ??
  0)`; everything else (`CONSUMABLE` items, computers) → `'present'`.
- **Discrepancy detection is a strict string-equality check** —
  `hasDiscrepancy = expectedValue !== actualValue` — with **no numeric
  tolerance**, even for counted quantities (expected `"3"` vs actual
  `"2"` is a discrepancy; there's no "off by one is fine" leniency).
- On submit, a computer line marked "present" updates that computer's
  `lastInventoried` timestamp; the parent kit's `updatedAt` is touched.
- `discrepancyCount` is computed on read, not a stored column.
- Any authenticated non-loanee user (Instructor or above) can start and
  submit a check — **no Quartermaster-only restriction**, unlike most
  catalog mutations.
- The client has two parallel UIs against the identical endpoints: an
  inline panel on the Kit Detail page, and a "quick check" modal
  launched from the Kit List page.

---

## 7. Issues & Notes

### 7.1 Issues (`routes/issues.ts`, `services/issue.service.ts`)

- Types: `MISSING_ITEM, REPLENISHMENT, DAMAGE, MAINTENANCE, OTHER`
  (validated, 400 on anything else).
- Must reference at least one of `packId`/`kitId`/`computerId`; if both
  `itemId` and `packId` are given, the item must actually belong to that
  pack (400 on cross-pack mismatch). Referenced entities are
  existence-checked (404 if missing).
- Lifecycle: create → `OPEN` (reporter = the acting user) → `PATCH
  /issues/:id/resolve` → `RESOLVED` (resolver + `resolvedAt` recorded,
  notes optionally overwritten). **Issues are terminal once resolved —
  there is no re-open path.** Resolving an already-resolved issue is a
  400.
- `GET /issues` supports filters: `status`, `packId`, `kitId`,
  `computerId`, `type` (AND-combined), newest first.
- **No Quartermaster-only gate** on either create or resolve — any
  authenticated non-loanee user can create *and resolve* issues.
- The desktop "Report Issue" modal (kit/pack/computer detail pages) is
  the path that creates a genuine typed `Issue` record.

### 7.2 Notes (`routes/notes.ts`, `services/note.service.ts`)

- Attach to `objectType ∈ {'Kit','Pack','Computer'}` + numeric
  `objectId` — **no referential check** against the actual entity
  (unlike Issue), so a note can point at a nonexistent id.
- CRUD requires only `requireAuth`; there is **no author-only
  restriction** — any authenticated non-loanee user can edit or delete
  any other user's note despite `userId` being recorded.
- **Discrepancy worth flagging**: the mobile QR page's "Report Issue"
  quick action (`ReportIssueAction.tsx`) actually posts a **Note**
  (`POST /notes`), not a typed `Issue` — this is a different, less
  structured mechanism than the desktop "Report Issue" modal, despite
  sharing the same label in the UI. A user who "reports an issue" from a
  QR scan does not create anything that shows up in the Issues list or
  the Issues report filters.

---

## 8. Labels & QR Codes

`server/src/routes/labels.ts` + `services/label.service.ts`;
`server/src/routes/qr.ts` + `services/qr.service.ts`.

**`docs/label-spec.md` is stale.** It describes the current landscape
two-column layout as a *target* still to be implemented, and a portrait
stacked layout as the *current* state. The code already fully implements
the landscape target: PDFKit doc, `layout: 'landscape'`, 59mm×102mm Dymo
label, header row (vector-drawn flag logo + org name + contact line), and
a two-column content row (large number + QR on the left, name on the
right).

- **Kit label**: number = `kit.number`; right column = kit name (+
  description if present); QR target `/qr/k/{kitId}`.
- **Pack label**: number = `"{kitNumber}/{sequence}"`, sequence = 1-based
  position of the pack among the kit's packs ordered by `id`; right
  column = pack name only; QR target `/qr/p/{packId}`.
- **Computer label** (full 59×102mm): number/title = host name, else
  model, else `"Computer #id"`; QR target `/qr/c/{computerId}`.
- **Compact computer label** (89×28mm, separate portrait layout): QR +
  raster flag logo (`assets/flag.png`) + machine name + student
  username/password + a combined kit/OS/serial info line.
- **Batch endpoints**: `POST /labels/computers/batch` (compact labels,
  one page per id, PDF), `POST /labels/kit/:id/batch-pdf` (kit + selected
  pack labels, multi-page PDF), `POST /labels/kit/:id/batch` (same
  content but as **printable HTML** with `@page` CSS and an
  auto-`window.print()` — an alternate output path used for
  browser-print workflows instead of server-rendered PDF).
- `GET /labels/qr/:type/:id` — a raw 120px QR PNG for embedding on detail
  pages.
- All label routes require only `requireAuth` — printing is not
  Quartermaster-gated.
- QR target base URL resolves from `QR_DOMAIN`, then `APP_BASE_URL`, then
  `http://localhost:5173`.

**Two independent QR-encoding paths worth flagging** (a real
inconsistency, not a design choice):
- Printed labels (`label.service.ts`) encode `{baseUrl}/qr/k|p|c/{id}` —
  the mobile action pages (transfer, report issue, add photo).
- The public JSON info endpoint (`GET /qr/k|p|c/:id`, no auth required)
  encodes `{baseUrl}/k|p|c/{id}` in a `qrDataUrl` field for the "legacy"
  desktop-redirect landing page — this matches what `docs/label-spec.md`
  describes, but is **not** what is actually printed on physical labels.

Scanning a physical label reaches `/qr/k|p|c/:id` (`QrLayout` +
`QrKitPage`/`QrPackPage`/`QrComputerPage`), which gates on sign-in
(`useQrAuth`) and offers action buttons: transfer (combined checkout/
check-in via `/transfers`), report issue (creates a Note, see §7.2), and
add photo. Scanning a "legacy" `/k|p|c/:id` short URL (`QrLanding`)
instead redirects a signed-in user straight to the full desktop detail
page, or shows a minimal info card + Google sign-in link if anonymous.

---

## 9. Images

`server/src/routes/images.ts`, `services/image.service.ts`,
`services/s3.ts`.

- **Storage backend: DigitalOcean Spaces (S3-compatible)**, not local
  disk — plus two legacy fallback modes still supported for older rows:
  an external `url`, or inline `bytea` (`Image.data`).
- **Upload pipeline**: buffer → `sharp` resize (max 1600px longest side,
  no upscaling) → re-encode to WebP quality 80 → SHA-256 checksum over
  the processed bytes → object key `images/{checksum}.webp` → uploaded
  `public-read`. This is content-addressed at the storage-key level, but
  **not deduplicated at the DB level** — every upload creates a new
  `Image` row even if the checksum matches an existing one.
- **URL-based images** (`createFromUrl`): fetches metadata (dimensions,
  checksum, mime) but stores the original external URL rather than
  copying the bytes into S3; failures are swallowed (record still
  created with zeroed metadata).
- **Serving** (`GET /images/:id`): three-way branch on which storage
  field is populated — redirect to the external URL, redirect to the
  Spaces public URL, or stream the legacy inline bytes with ETag/304
  support. **This route has no `requireAuth` middleware** — image
  serving by id appears unauthenticated by design (or oversight; flagged
  as an open question).
- Uploading a replacement image for an already-illustrated Computer/Kit/
  Pack best-effort deletes the previously attached image.
- Upload/attach/detach/delete require `requireQuartermaster`; list/serve
  require only `requireAuth` (serve arguably requires nothing, see above).

---

## 10. Search & Reports

### 10.1 Search (`routes/search.ts`, `services/search.service.ts`)

- Single endpoint `GET /search?q=&limit=` fanning out to 9 parallel
  Prisma queries across Kit (active only), Pack, Item, Computer, Site,
  User, HostName, Category, and Manufacturer.
- Plain Postgres `ILIKE` (`contains`, case-insensitive) per field — **no
  trigram index, full-text search, or LISTEN/NOTIFY** despite the
  project's README describing PostgreSQL-native alternatives to
  Mongo/Redis as a general convention; search itself doesn't use them.
- A numeric query is treated as a kit-number shortcut in addition to
  substring matching; queries must be ≥2 characters otherwise.
- Result cap (`limit`, default 20, max 100) is applied per-subquery and
  again on the merged array, so a match-heavy entity can crowd out
  others in the final result set.
- **The standalone `SearchPage.tsx` client route is not wired into
  `App.tsx`** — there is no `/search` route. The actual search UI users
  interact with is an inline dropdown/overlay built into the app shell
  (`AppLayout.tsx`), a separate implementation from the orphaned page
  component.

### 10.2 Reports (`routes/reports.ts`, `services/report.service.ts`)

All JSON, `requireAuth`, no CSV/PDF export from this route file:

- `GET /reports/audit-log` — paginated (max page size 200), filterable
  by `objectType`, `objectId`, `userId`, `field` (contains), date range.
- `GET /reports/user-activity/:userId` — last N (default 50) audit rows
  for one user.
- `GET /reports/inventory-age` — for every active kit and
  active-disposition computer, days since last check/inventory;
  never-checked items sort first, then oldest-first.
- `GET /reports/transferred-by-person` — a **current-state snapshot**,
  not a transfer history: active kits and kit-less computers with a
  non-null custodian, grouped by custodian name. Despite the name, it
  does not query the `Transfer` table.

---

## 11. Import / Export

`server/src/routes/import-export.ts`, `services/import.service.ts`,
`services/export.service.ts`.

- **Export**: Excel (`.xlsx` via ExcelJS — Sites/Kits/Packs/Items/
  Computers sheets + a `_metadata` sheet) and JSON (same six entity sets,
  denormalized with names instead of FK ids, versioned). No CSV/PDF
  export.
- **Excel import** (two-step: `POST /import/preview` → `POST
  /import/apply`): diffs only a narrow field subset (Kit: name/
  description/containerType; Item: name/type/expectedQuantity), and the
  preview's "old value" is always reported as `null` rather than fetched
  from the current DB row — the diff view does not actually show what
  will be overwritten. Apply loops per-row (not a single transaction);
  a failure on one row is collected into an `errors[]` array while the
  rest continue — **partial-apply semantics, not atomic**.
- **CSV computer import** (`POST /import/computers-csv/preview` /
  `/apply`) is the richer path: hand-rolled CSV parser tolerant of
  leading junk/BOM, matches existing computers by `hostName` or
  `serialNumber` (caller-selectable), resolves Site/Kit/OS/Custodian/
  Category names to ids, auto-creates unknown host names, and treats
  unresolvable name references as **soft errors** (row still applies
  with the other fields, unresolved reference just reported). Also not
  transactional.
- Both routes require only `requireAuth`, not `requireQuartermaster`.
- **Documentation/code discrepancy**: `AuditSource` has an `IMPORT` enum
  value, but neither import path passes `source: 'IMPORT'` when writing
  audit entries — the shared `ServiceRegistry` is constructed with no
  `source` override anywhere it's actually used, so it falls through to
  the class default, `'UI'`. **All import-driven audit rows are
  currently recorded as `source: 'UI'`**, indistinguishable from manual
  edits in the audit log/report, despite the schema modeling `IMPORT` as
  a distinct source.

---

## 12. Admin Console

Gated by `requireAdmin` (admin password OR `role === 'ADMIN'`).

| Panel | Route(s) | What it does |
|---|---|---|
| Environment | `/admin/env` | Version, Node version, uptime, memory, DB connectivity, redacted `DATABASE_URL`, per-integration configured flags. |
| Database Viewer | `/admin/db` | Read-only table browser: lists `information_schema` tables + row counts, paginated `SELECT *` per table (table name validated against `information_schema` before use — no free-form WHERE/query). |
| Configuration | `/admin/config` | Key/value editor for 10 fixed keys (GitHub/Google/Pike13 credentials, GitHub PAT + storage repo, Anthropic/OpenAI keys, `INVENTORY_CHECK_INTERVAL_DAYS`). Env var always wins over the DB-stored value; secrets masked to last 4 chars; `.env`-format export. **Does not include `AI_CHAT_MODEL`/`AI_SCREENING_MODEL`** — those are separate, deploy-time-only env vars read directly by the AI chat service, not surfaced here. |
| Logs | `/admin/logs` | In-memory Pino ring buffer (max 500 entries), level filter; lost on restart, no persistence. |
| Sessions | `/admin/sessions` | Read-only list of active `session` rows (connect-pg-simple) — admin flag, authenticated/anonymous, provider, expiry. **No kill-session action exists.** |
| Permissions | `/admin/permissions` | CRUD for `QuartermasterPattern` (the auto-promotion rules, §1.3). |
| API Tokens | `/admin/tokens` | System-wide token list (all users) with revoke action, active/revoked/all filter. |
| Sites | `/admin/sites` | Same `SiteList` component reused from the main app. |
| Categories & Types | `/admin/categories` | Editable Category/OS/Manufacturer lists; read-only display of the fixed `ContainerType`/`ComputerDisposition` enums. |
| Trash | `/admin/trash` | Soft-deleted Kits and Computers — restore, or two-click-confirm permanent delete. |
| Import/Export | `/admin/import-export` | UI for the flows in §11 plus backup management. |
| Users | `/admin/users` | Full user CRUD, role assignment, delete blocked (409) if the user still custodies kits/computers. |
| Scheduled Jobs | `/admin/scheduled-jobs` | See §13. |

---

## 13. Scheduler & Backups

`server/src/routes/scheduler.ts`, `services/scheduler.service.ts`,
`services/backup.service.ts`, `services/backupRotation.service.ts`.

- **Only two jobs exist in practice**: `daily-backup` and
  `weekly-backup`, seeded by migration and wired to
  `BackupRotationService`. The generic `ScheduledJob` model suggests
  extensibility, but there is no "create job" API or UI — only
  enable/disable and "run now" for the two seeded rows.
- **Trigger mechanism is not a real cron**: a middleware
  (`schedulerTick.ts`) mounted on nearly every HTTP request checks an
  in-memory timer (default every 5 minutes) and, when due, fires an
  unawaited `GET /scheduler/tick`. **A fully idle server never ticks** —
  scheduling is piggybacked on live traffic, not a background timer or
  OS-level cron.
- Multi-instance safety uses Postgres row locking (`SELECT ... FOR
  UPDATE SKIP LOCKED` inside a transaction), not LISTEN/NOTIFY.
- **Backups**: `pg_dump --format=custom` (falls back to a throwaway
  Docker `postgres:16-alpine` container in local dev if `pg_dump` isn't
  on PATH). Stored locally (`BACKUP_PATH`) and uploaded to DigitalOcean
  Spaces. Filenames encode kind/day-or-week-slot/date/env/version.
  Daily backups overwrite the same weekday's prior dump; weekly backups
  keep the 4 most recent. Scheduled (`daily-`/`weekly-` prefixed)
  backups **cannot be deleted manually**; only ad-hoc backups can be
  deleted by an admin. Restore downloads from Spaces if not present
  locally, then `pg_restore --clean --if-exists`.

---

## 14. AI Chat & Slack

`server/src/routes/ai-chat.ts`, `routes/slack.ts`,
`services/ai-chat.service.ts`.

- **Provider**: Anthropic Claude only (`@anthropic-ai/sdk`) — no OpenAI
  SDK usage in this service despite an `OPENAI_API_KEY` admin-config
  slot existing. `GET /ai/status` reports the feature disabled if
  `ANTHROPIC_API_KEY` is unset.
- **Models**: `AI_CHAT_MODEL` (default `claude-sonnet-5`) drives the main
  tool-use chat loop; `AI_SCREENING_MODEL` (default `claude-haiku-4-5`)
  runs a cheap topic-relevance guard before every message. Both are read
  from `process.env` at module load — they are deploy-time env vars set
  in `config/{dev,prod}/public.env`, **not** a runtime admin-config
  setting.
- **Capability**: a full agentic tool-use loop over the same service
  layer as the UI — list/get/create/update/delete for sites, kits,
  packs, items, computers, host names; kit/computer transfers; issue
  create/list/resolve. Page context (current entity being viewed) and
  the user's last 5 audit entries are injected into the system prompt.
- **Role gating is client-side only**: the tool list sent to Claude is
  pre-filtered by `hasQMAccess(role)`, but the tool-execution function
  itself performs **no role check** — a bug in the filtering logic would
  have nothing stopping it at execution time.
- **Slack** (`routes/slack.ts`) shares the identical `AiChatService`
  class (separate instance, not a shared singleton). HMAC-SHA256 request
  verification, 5-minute replay window. Slack users are matched to
  inventory `User` rows by email, then by display name. Slash commands
  `/inventory`, `/haswhat`, `/whereis`, `/sites`, `/kits` are hand-coded
  direct lookups; `/checkin`, `/checkout`, `/transfer`, `/report` are
  thin wrappers that repackage the command text into a prompt and hand
  it to the same AI tool-use loop. Conversation history persists to the
  `SlackConversation` table (last 5 turns reloaded per user); web chat
  keeps history client-side instead.
- **Audit attribution**: both the AI chat path and the Slack path write
  through `ServiceRegistry.create(undefined, 'MCP')` — meaning
  AI-assistant-driven and Slack-driven writes are indistinguishable in
  the audit log's `source` field from genuine external MCP client calls.

---

## 15. MCP Server

`server/src/mcp/server.ts`, `mcp/tools.ts`, `mcp/context.ts`; mounted at
`app.all('/api/mcp', mcpTokenAuth, createMcpHandler(prisma))`.

- Streamable HTTP transport (`@modelcontextprotocol/sdk`), stateless
  (`sessionIdGenerator: undefined`).
- **Two auth paths**: a Bearer API token (`Authorization: Bearer
  <token>`, validated via `TokenService`) for Claude Code/Desktop
  configs, and a separate OAuth authorization-code + PKCE flow
  (`routes/oauth.ts`) for the claude.ai web connector, using the same
  Google-domain sign-in.
- A server-level prompt (`instructions`) tells the connecting LLM to
  never surface database IDs and to address kits by `number`, not `id`
  (matching the "never expose IDs" rule in `AGENTS.md`).
- **`docs/mcp.md` documents `checkout_kit`/`checkin_kit` tools that do
  not exist.** The actual implemented primitive is generic `transfer_kit`
  / `transfer_computer` (custodian/site reassignment) — the real
  checkout/check-in mechanism described in §5, exposed as an MCP tool
  under a different name than the docs state.
- The implemented tool surface is **substantially larger** than
  documented: undocumented tools include `get_version`, `delete_site`,
  `delete_kit`, `set_kit_last_inventoried`, full CRUD for operating
  systems, `delete_computer`, hostname create/update/delete, full image
  CRUD/attach/detach, `transfer_kit`/`transfer_computer`, and full note
  and issue CRUD (`list_notes/create_note/update_note/delete_note`,
  `list_issues/create_issue/resolve_issue`).
- **Role-enforcement gap**: mutating tools for sites/kits/packs/items/
  OS/computers/hostnames/images call a `requireQM()` guard, but
  `transfer_kit`, `transfer_computer`, `create_issue`, `resolve_issue`,
  and `list_issues` do **not** — any valid token holder, Instructor or
  Quartermaster, can transfer custody or create/resolve issues via MCP.
  The service layer (`issue.service.ts`) takes no role parameter either,
  so there is **no server-side role enforcement anywhere** for issue
  create/resolve — only the AI-chat path's client-side tool-list
  filtering approximates one.
- Every MCP-driven write is recorded with `AuditSource.MCP` (shared with
  the AI chat and Slack paths, see §14).

**Token model** (`routes/tokens.ts`, `services/token.service.ts`):
32 random bytes, SHA-256 hashed for storage, first 8 hex chars kept as a
display `prefix`. `role` is a **snapshot of the user's role at creation
time**. `docs/mcp.md` states role changes automatically revoke a user's
tokens — **this is not implemented**: `TokenService.revokeAllForUser()`
exists and is unit-tested, but no caller in the codebase invokes it (the
admin Users panel's role-change endpoint does not call it). A token
retains its original privilege snapshot until it expires or is manually
revoked, even after the underlying user's role changes. Token management
endpoints (`/tokens`, `/admin/tokens`) are session-only — genuinely
unreachable via a Bearer-token request, matching the doc's claim there.

---

## 16. Other Integrations

- **GitHub OAuth** and **Pike13** (`routes/auth.ts`'s GitHub strategy,
  `routes/oauth.ts`? — actually separate files not detailed here; see
  `docs/api-integrations.md`) are wired at the route/Passport level and
  have admin-config credential slots, but **no inventory-domain feature
  consumes them** — no client page beyond the deleted example
  integrations page and a configured/not-configured flag on the admin
  Environment page. They read as leftover scaffolding from the
  underlying application template this project was built from, not
  active inventory features. See Open Questions.

---

## 17. Data Model & Audit Trail Summary

Full schema: `server/prisma/schema.prisma`. Cross-cutting notes:

- **Audit trail**: `AuditLog` (objectType/objectId/field/oldValue/
  newValue/source/createdAt) is written by nearly every mutating service
  via a shared `BaseService.auditFields` diff pattern — with the
  exceptions/discrepancies already called out per-domain above (Hostname
  create not audited; import writes tagged `UI` instead of `IMPORT`; AI/
  Slack/MCP writes all tagged `MCP` indistinguishably).
- **Soft delete** exists for Kit, Computer, and Manufacturer
  (`deletedAt`), but the restore/permanent-delete/trash-list API surface
  is only fully implemented for Kit and Computer — Manufacturer soft-
  deletes are effectively one-way via the exposed routes.
- **Sessions**: `Session` table matches the `connect-pg-simple` schema
  exactly (required for the Express session store).

---

## Open Questions

1. **GitHub OAuth / Pike13 integrations** — are these still intended for
   future use, or are they dead template scaffolding that should be
   removed along with their admin-config slots? No stakeholder guidance
   found in the repo.
2. **`GET /images/:id` has no `requireAuth`** — is unauthenticated image
   serving by id intentional (images are meant to be publicly linkable),
   or an oversight?
3. **Token revocation on role change** (`docs/mcp.md`'s claim) — is the
   missing `revokeAllForUser()` call in the admin Users panel a bug to
   fix, or was the doc aspirational and never implemented on purpose?
4. **`checkout_kit`/`checkin_kit` MCP tool names in `docs/mcp.md`** — is
   the actual `transfer_kit`/`transfer_computer` naming the intended
   final API, with the doc simply stale, or was a friendlier
   checkout/checkin-named tool pair intended and never built?
5. **MCP role gating gap on `transfer_*`/`create_issue`/`resolve_issue`**
   — is it intentional that any authenticated token (Instructor-level)
   can transfer custody or manage issues via MCP/AI chat, given the web
   UI itself doesn't restrict these actions either (§5, §7.1 confirm no
   QM gate exists at the service layer for transfers or issues)? If so,
   this is consistent, not a gap — but it should be a deliberate,
   documented decision rather than an implicit one.
6. **Import audit source** — should `AuditSource.IMPORT` actually be
   wired through the import services (a real fix), or should the enum
   value be removed if `UI` attribution for imports is acceptable?
7. **`CUSTODIAN` role** — is it meant to eventually carry distinct
   authorization semantics (e.g., can custody without full Instructor
   access), or is it purely a descriptive/reporting label with no
   permission implications by design?
8. **Orphaned `SearchPage.tsx` and `/quartermasters/patterns` routes** —
   safe to delete, or reserved for a future direct-link/API use case?
9. **Label spec doc vs. implementation** — `docs/label-spec.md` should be
   updated to describe the landscape layout as *current*, not *target*;
   flagging here rather than editing that file per this task's scope.
10. **Test coverage gap**: no test in the sampled suite exercises a
    403 for an Instructor attempting a Quartermaster-only write — role
    enforcement exists in code but appears largely unverified by tests
    at the API layer in this snapshot.
