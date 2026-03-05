---
id: '004'
title: Kit and Pack Catalog
status: done
branch: sprint/004-kit-and-pack-catalog
use-cases:
- UC-4.1
- UC-4.2
- UC-4.4
- UC-4.11
---

# Sprint 004: Kit and Pack Catalog

## Goals

Implement full CRUD for Kits, Packs, and Items, including the object
hierarchy (Kit → Pack → Item), QR code generation, and Kit cloning.

## Problem

There is no way to create or manage the primary inventory objects. Kits,
Packs, and Items need to be created, viewed, edited, and organized before
any checkout or inventory operations can happen.

## Solution

- Kit CRUD: create, list, view detail, edit, retire. Assign to a home Site.
- Pack CRUD: create within a Kit, list, view, edit. Nested under Kit.
- Item CRUD: add Items to a Pack (counted or consumable), edit quantities,
  remove.
- QR code generation for Kits and Packs at creation time. QR codes resolve
  to the item's URL per the QR Code System spec.
- Clone Kit: duplicate a Kit's Pack and Item structure into a new Kit with
  new QR codes (Computers are not cloned).

## Success Criteria

- Quartermaster can create a Kit, add Packs to it, add Items to Packs.
- Each Kit and Pack gets a unique QR code on creation.
- QR code URLs resolve correctly (authenticated → detail page,
  unauthenticated → public landing page).
- Quartermaster can clone a Kit and get a new Kit with identical Pack/Item
  structure but new IDs and QR codes.
- Kit detail view shows full hierarchy: Packs, Items, and any assigned
  Computers (read-only for now).
- All changes are recorded in the audit log.

## Scope

### In Scope

- Kit CRUD (UC-4.1, UC-4.4)
- Pack CRUD (UC-4.2, UC-4.4)
- Item CRUD within Packs (UC-4.4)
- QR code generation (Kit and Pack)
- QR code URL routing (authenticated and unauthenticated views)
- Clone Kit (UC-4.11)
- Kit detail view with hierarchy
- Audit log entries for all changes

### Out of Scope

- Computer CRUD and assignment (sprint 005)
- Checkout operations (sprint 006)
- Label printing (sprint 009)
- Inventory checks (sprint 007)

## Test Strategy

- Backend API tests: Kit/Pack/Item CRUD endpoints, QR code generation,
  clone logic, audit log writes.
- Database tests: hierarchy constraints, cascading behavior.
- Frontend tests: Kit creation form, Pack/Item management, clone flow,
  QR code display.

## Architecture Notes

- QR codes are generated server-side (e.g., `qrcode` npm package) and
  stored as a URL reference, not as image blobs.
- The public QR landing page is a lightweight route that does not require
  authentication.
- Clone Kit creates new database records with new IDs; it does not copy
  Computers or checkout history.

## Definition of Ready

Before tickets can be created, all of the following must be true:

- [ ] Sprint planning documents are complete (sprint.md, use cases, technical plan)
- [ ] Architecture review passed
- [ ] Stakeholder has approved the sprint plan

## Tickets

(To be created after sprint approval.)
