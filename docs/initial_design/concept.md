# League of Amazing Programmers — Inventory System Overview

## Purpose

This document describes the inventory management system for the League of Amazing Programmers (LAP). It covers the objects the system tracks, the workflows it supports, and the use cases it must handle. It is intended as the specification baseline from which the data model and application will be designed.

---

## System Context

LAP manages a fleet of computing equipment and teaching materials distributed across two primary storage sites and approximately 30 school/teaching sites. Instructors check equipment out to bring to classes and return it when done. The primary challenge is maintaining accurate knowledge of where things are, what condition they're in, and what's missing or broken.

The system replaces a Google Sheets spreadsheet maintained manually. It must import existing data from that spreadsheet.

**Primary storage sites:**
- Carmel Valley — main classroom
- Robot Garage (Busboom) — secondary storage

**Technology stack:** Node.js / Express / React / PostgreSQL / Passport (Google OAuth) / Docker

**Domain:** jointheleague.org — the app will run at a subdomain such as `inv.jointheleague.org`

---

## Core Objects

| Object | Description |
|---|---|
| **Kit** | The primary checkout unit. A physical bag, tote, or hard case that travels as a whole. An instructor checks a Kit in or out. Each Kit has a unique QR code. |
| **Pack** | A sub-container within a Kit. Typically a pencil box or small labeled case. Packs are inventoried but not independently checked out. Each Pack has a unique QR code. |
| **Item** | A line in a Pack's manifest. Either a *counted item* (quantity tracked — e.g., 10 micro:bits) or a *consumable* (presence noted but not counted — e.g., batteries, USB cables). |
| **Computer** | An individual computing device (laptop, Chromebook, iMac, etc.). Has a unique host name, hardware identifiers, and a disposition. May be assigned to a Kit or located at a fixed Site. Has its own QR code and label format. |
| **Site** | A named location. Includes the two home sites and any school or teaching site. Has a known address and optional GPS coordinates. |
| **User** | A league member, authenticated via Google OAuth against the jointheleague.org domain. Has a role: Instructor or Admin. |
| **Checkout** | A transaction recording that a Kit was taken by a User, when, and to which Site. Closed when the Kit is returned. |
| **Audit Log** | An append-only record of every change to any object: who, what changed, old value, new value, timestamp, and source. |

### Item Types

| Type | Behavior |
|---|---|
| Counted | Quantity is tracked. Flags can be raised when count drops. |
| Consumable | Presence/absence is noted; quantity is not tracked. Instructors can flag that replenishment is needed. |

### Computer Disposition States

| State | Meaning |
|---|---|
| Active | In service, location known. |
| Loaned | On long-term loan to a school or partner organization (distinct from a normal Kit checkout). |
| Scrapped | Broken or worn out; removed from service. |
| Lost | Location unknown. |
| Decommissioned | Intentionally retired; not broken or missing. |

---

## Object Hierarchy

```
Kit  (checked in/out as a unit)
 ├── Pack  (sub-container, inventoried in place)
 │    └── Item  (counted or consumable)
 └── Computer  (may be assigned to a Kit or to a fixed Site)

Computer  (also exists independently of Kits)
 └── assigned to a Site when not in a Kit
```

A Computer can move between Kits over time. When a Kit is checked out, any Computers assigned to it implicitly travel with it.

---

## Host Naming

Each Computer that runs Linux is assigned a name from a curated list of computer scientist names (e.g., Boole, Brin, Cerf). This name is used for dynamic DNS and Bonjour-based discovery on the local network. The name is part of the Computer's record. The system maintains the list of available names and tracks which are assigned to which devices.

---

## Use Cases

### Overview of Operations

The system supports five categories of operation:

1. **Checkout operations** — moving Kits between users and sites
2. **Inventory operations** — verifying and updating the contents of Kits and Packs
3. **Issue reporting** — flagging missing items or consumables needing replenishment
4. **Catalog management** — creating, editing, and retiring all object types
5. **Reporting** — querying current state and history

---

### 1. Checkout Operations

#### UC-1.1 Check Out a Kit

An instructor intends to take a Kit to a teaching site.

1. Instructor opens the web app on their phone (already logged in via Google).
2. Instructor scans the QR code on the Kit.
3. App identifies the Kit and shows its current status: location, last checkout, contents summary.
4. App uses the phone's GPS to suggest the most likely destination site. Instructor confirms or selects a different site.
5. Checkout is recorded: Kit, instructor, destination site, timestamp.

#### UC-1.2 Check In a Kit

An instructor is returning a Kit.

1. Instructor scans the QR code on the Kit.
2. App sees the Kit is currently checked out and presents the check-in flow.
3. App uses GPS to suggest the current location as the return site. Instructor confirms or selects a different site.
4. Checkout record is closed: return site and timestamp recorded.

#### UC-1.3 View Currently Checked-Out Kits

Admin or instructor views which Kits are currently out, who has them, and their stated destination.

---

### 2. Inventory Operations

#### UC-2.1 Perform an Inventory Check on a Kit

An instructor or admin verifies the full contents of a Kit.

1. Instructor scans the QR code on the Kit.
2. App presents a checklist of all Packs and their Items, plus any Computers assigned to the Kit.
3. Instructor taps each item present or marks it absent.
4. Submission records the inventory check with timestamp and user. Discrepancies are flagged.

#### UC-2.2 Perform an Inventory Check on a Pack

Same as UC-2.1 but scoped to a single Pack.

#### UC-2.3 Verify a Computer Exists

Admin or instructor scans a Computer's QR code to confirm it is present at its expected location. The "last inventoried" date on the Computer record is updated.

---

### 3. Issue Reporting

#### UC-3.1 Flag a Missing Item

1. Instructor scans the Pack's QR code.
2. App shows the Pack's contents.
3. Instructor marks the specific Item as missing and optionally adds a note.
4. Issue is recorded with audit trail.

#### UC-3.2 Flag a Consumable Needs Replenishment

1. Instructor scans the Pack's QR code.
2. Instructor marks the consumable as needing replenishment, optionally adds a note.
3. Issue is recorded.

#### UC-3.3 Resolve an Issue

Admin reviews open issues and marks them resolved after replenishment or repair.

---

### 4. Catalog Management

#### UC-4.1 Create a New Kit

1. Admin opens the Kit creation form.
2. Enters name, description, assigned site, and any initial notes.
3. System assigns a sequential ID and generates a QR code resolving to the Kit's URL.
4. Admin can immediately add Packs and assign Computers to the Kit.

#### UC-4.2 Add a Pack to a Kit

1. From a Kit record, admin selects "Add Pack."
2. Enters pack name/label and description.
3. System assigns an ID and generates a QR code.
4. Admin adds Items (counted or consumable, with initial quantities for counted items).

#### UC-4.3 Add or Edit a Computer

Admin creates or edits a Computer record with the following attributes:

- Host name (assigned from the names list)
- Serial number
- Service tag
- Model
- Default username and password
- Location (Site or Kit assignment)
- Disposition
- Date received
- Last inventoried date
- Notes

All changes are written to the audit log.

#### UC-4.4 Edit a Kit, Pack, or Item

Standard edit form for any object. All changes written to audit log with previous and new values.

#### UC-4.5 Retire or Scrap an Object

Admin sets the disposition of a Kit (retired) or Computer (Scrapped, Lost, Decommissioned, etc.). The object is removed from active inventory but retained in the database with full history.

#### UC-4.6 Manage the Names List

Admin can view the list of computer scientist names, see which are assigned and which are available, and add new names to the pool.

#### UC-4.7 Manage Sites

Admin can add, edit, or deactivate Sites. Each Site has a name, address, and optional GPS coordinates. A short list of "home" sites (currently Carmel Valley and Robot Garage) is used as defaults for check-in.

#### UC-4.8 Print Labels

Admin selects one or more objects and requests label printing. Labels are generated as a downloadable PDF. Four label formats are supported:

| Format | Size | Used For |
|---|---|---|
| Kit label | 59mm × 102mm (Dymo large shipping) | Kits |
| Pack label — large | 59mm × 102mm | Larger packs and totes |
| Pack label — small | Avery 30334 (dimensions TBD) | Smaller pencil boxes |
| Computer label | TBD — orange, durable material | Individual computers |

All labels include: League name, logo, contact URL, phone number, item name/ID, and a QR code.

The Computer label additionally includes: host name, serial number, and default username/password.

Admin can select a Kit and choose "print all labels" to generate labels for the Kit and all its Packs in one PDF, with the option to include a subset.

#### UC-4.9 Import Data from Spreadsheet

Admin uploads a spreadsheet (Excel or CSV) to import or update records.

- System diffs incoming data against current database state.
- Changes are applied with audit log entries indicating the import as the source.
- Fields changed in the DB since the last export are flagged for review before overwrite.
- Future phase: automatic detection of changes to a linked Google Sheet.

#### UC-4.10 Export to Spreadsheet

Admin exports current inventory state to Excel or Google Sheets. Intended for bulk editing workflows where the spreadsheet is faster than the web UI.

---

### 5. Reporting

#### UC-5.1 Kit Detail Report

All information about a specific Kit: current status, who has it, location, full contents, assigned Computers, open issues, and checkout history.

#### UC-5.2 Computer Detail Report

All information about a specific Computer: hardware attributes, current location/Kit assignment, disposition, last inventoried date, and full change history.

#### UC-5.3 Checked-Out Items by Person

All Kits currently checked out to a specific instructor.

#### UC-5.4 Checkout History for a Kit

Full timeline of every checkout and check-in for a Kit, with user and site at each step.

#### UC-5.5 Open Issues Report

All currently unresolved issue flags across all Kits and Packs.

#### UC-5.6 Inventory Age Report

Kits, Packs, and Computers sorted by date of last inventory check, oldest first.

#### UC-5.7 Audit Log Query

Admin queries the audit log by object, user, date range, or field changed.

---

## Authentication and Access Control

- Login is via Google OAuth restricted to the jointheleague.org domain.
- Two roles: **Instructor** and **Admin**.
- Instructors can: check in/out Kits, flag issues, perform inventory checks, verify Computers.
- Admins can additionally: create/edit/retire any object, manage Sites and Names, print labels, import/export data, view audit logs.

---

## QR Code System

- Every Kit, Pack, and Computer gets a unique QR code at creation.
- QR codes resolve to URLs:
  - Kit: `https://inv.jointheleague.org/k/{id}`
  - Pack: `https://inv.jointheleague.org/p/{id}`
  - Computer: `https://inv.jointheleague.org/d/{id}`
- When an authenticated user scans a code, they are taken directly to the item page with contextually appropriate actions.
- When an unauthenticated user scans a code, they see a public-facing page showing: org name, contact URL, phone number, and item name/ID — enough to return the item to LAP. Login credentials are not shown. The user is offered the option to log in.

---

## Audit Trail

Every write operation generates an audit log entry containing:

- Timestamp
- User who made the change
- Object type and ID
- Field(s) changed
- Previous value(s)
- New value(s)
- Source (UI, spreadsheet import, API)

The audit log is append-only and cannot be edited or deleted by any user role.

---

## Out of Scope (Phase 1)

- SMS check-in/check-out interface
- Slack integration
- Automatic Google Sheets sync (export/import is manual in Phase 1)
- Linux install automation (HostDB workflow); the system stores the host name but does not manage the install process
