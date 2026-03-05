---
status: complete
from-architecture-version: null
to-architecture-version: null
---

# Sprint 006 Technical Plan

## Architecture Version

- **From version**: Current (Sprint 004/005 state)
- **To version**: No architectural change — adds routes and pages
  following existing patterns

## Architecture Overview

Sprint 006 adds Computer CRUD and Host Name management. The backend
follows the same Express router pattern used by Kits/Packs/Items. The
frontend adds Computer list, detail, and form pages plus a Host Names
management page.

```
Client                          Server                    Database
──────                          ──────                    ────────
ComputerList  ──GET /api/computers──►  computers.ts  ──►  Computer
ComputerDetail──GET /api/computers/:id─►              ──►  HostName
ComputerForm  ──POST/PUT──────────────►              ──►  AuditLog
HostNameList  ──GET /api/hostnames────►  hostnames.ts ──►  HostName
```

## Component Design

### Component: Computer API Routes

**Use Cases**: SUC-001, SUC-002, SUC-003, SUC-005

File: `server/src/routes/computers.ts`

Endpoints:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/computers | requireAuth | List computers with optional filters (disposition, siteId, kitId, unassigned) |
| GET | /api/computers/:id | requireAuth | Computer detail with hostName, site, kit |
| POST | /api/computers | requireQuartermaster | Create computer, generate QR code |
| PUT | /api/computers/:id | requireQuartermaster | Update computer fields |
| PATCH | /api/computers/:id/disposition | requireQuartermaster | Change disposition only |

Follows the same pattern as `kits.ts`:
- `COMPUTER_FIELDS` constant for audit log field list
- `diffForAudit()` for update change tracking
- QR code path: `/c/{id}`
- Include `hostName`, `site`, `kit` in responses

### Component: Host Name API Routes

**Use Cases**: SUC-004

File: `server/src/routes/hostnames.ts`

Endpoints:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/hostnames | requireAuth | List all host names with assignment status |
| POST | /api/hostnames | requireQuartermaster | Add a new host name to the pool |
| DELETE | /api/hostnames/:id | requireQuartermaster | Remove an unassigned host name |

Host name assignment/unassignment happens through the Computer
create/update endpoints (setting `hostNameId` on the Computer form
triggers an update to the HostName record).

### Component: Computer Frontend Pages

**Use Cases**: SUC-001, SUC-002, SUC-003, SUC-005

Files:
- `client/src/pages/computers/ComputerList.tsx` — Filterable list with
  disposition badges
- `client/src/pages/computers/ComputerDetail.tsx` — Full detail view
  with QR code, host name, assignment, disposition controls
- `client/src/pages/computers/ComputerForm.tsx` — Create/edit form with
  host name picker (dropdown of available names), Kit/Site assignment
  selector

### Component: Host Name Frontend Page

**Use Cases**: SUC-004

File: `client/src/pages/computers/HostNameList.tsx`

Shows all host names in a table with columns: Name, Status
(Available/Assigned), Assigned Computer (link). Includes an "Add Host
Name" form. Accessible from Computer list page nav.

### Component: QR Route for Computers

**Use Cases**: SUC-001

Update `server/src/routes/qr.ts` to add `GET /api/qr/c/:id` for
Computer QR lookups. Update `client/src/pages/kits/QrLanding.tsx` to
handle `/c/:id` paths.

### Component: App Routes

**Use Cases**: All

Update `client/src/App.tsx` with routes:
- `/computers` → ComputerList
- `/computers/new` → ComputerForm
- `/computers/:id` → ComputerDetail
- `/computers/:id/edit` → ComputerForm
- `/hostnames` → HostNameList
- `/c/:id` → QrLanding (Computer QR)

Update `client/src/pages/Landing.tsx` with nav link to Computers.

## Open Questions

None — the data model already exists in the Prisma schema. This sprint
is purely implementing the API routes and frontend pages.
