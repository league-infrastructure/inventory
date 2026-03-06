# Inventory System Bug Report — Computer/Kit Site Inconsistencies

**Date:** 2026-03-06  
**Reporter:** Eric Busboom (via Claude)  
**Severity:** Medium — data integrity issue, no data loss

---

## Bug 1: Computer.siteId disagrees with Kit.siteId for computers assigned to a kit

### Description

When a computer is assigned to a kit (`computer.kitId` is set), the computer's own `siteId` can differ from the kit's `siteId`. There is no enforcement — either at write time or via a derived/computed field — that keeps them in sync.

### Expected behavior

A computer assigned to a kit should inherit or reflect the kit's site. Either:

- `computer.siteId` should be automatically set to `kit.siteId` when `computer.kitId` is assigned or when `kit.siteId` changes (i.e., the kit's site is the source of truth), **or**
- `computer.siteId` should be a computed/virtual field derived from the kit's site when the computer belongs to a kit, **or**
- An API-level validation should reject updates that create a mismatch.

### Actual behavior

Both fields are independently writable with no consistency check.

### Example: Kit 1 (Chromebooks)

- **Kit 1** `siteId: 2` (Busboom)
- All 5 computers in Kit 1 have `siteId: 1` (Carmel Valley)

| Computer ID | Hostname  | computer.siteId | kit.siteId |
|-------------|-----------|-----------------|------------|
| 1           | Boole     | 1 (Carmel Valley) | 2 (Busboom) |
| 2           | Brin      | 1 (Carmel Valley) | 2 (Busboom) |
| 3           | Cerf      | 1 (Carmel Valley) | 2 (Busboom) |
| 4           | Engelbart | 1 (Carmel Valley) | 2 (Busboom) |
| 5           | Gray      | 1 (Carmel Valley) | 2 (Busboom) |

### Scope of impact

This affects Kit 1 specifically. Other Dell laptop kits (2–5) appear consistent — their computers' siteIds match their kit's siteId.

---

## Bug 2: All HP laptop computers have `siteId: null` despite belonging to kits with assigned sites

### Description

Every computer in kits 9, 10, and 11 (all HP Laptops) has `siteId: null`, even though each kit has a non-null site assignment.

### Example: Kit 9 (HP Laptops, site: Alfred)

| Computer ID | Hostname | computer.siteId | kit.siteId |
|-------------|----------|-----------------|------------|
| 40          | Wilkes   | null            | 3 (Alfred) |
| 41          | Wirth    | null            | 3 (Alfred) |
| 42          | Aho      | null            | 3 (Alfred) |
| 43          | Bayer    | null            | 3 (Alfred) |
| 44          | Clark    | null            | 3 (Alfred) |
| 45          | Cook     | null            | 3 (Alfred) |

### Kit 10 (HP Laptops, site: Jed) — same pattern, 5 computers, all siteId: null

### Kit 11 (HP Laptops, site: Busboom) — same pattern, 5 computers, all siteId: null

**Total affected:** 16 HP laptop records across 3 kits.

---

## Recommended fix

This is the same root cause as Bug 1 — the system allows `computer.siteId` and `kit.siteId` to diverge. The fix options are:

1. **Derived site (preferred):** When a computer belongs to a kit, its effective site should be the kit's site. Either make `computer.siteId` a computed field when `kitId` is non-null, or remove `siteId` from computer records that belong to kits entirely and resolve site through the kit relationship. The API response can still include the site info — just derive it from the kit.

2. **Sync on write:** When assigning a computer to a kit, automatically set `computer.siteId = kit.siteId`. When transferring a kit to a new site, update all member computers' siteIds. This is simpler but creates a second source of truth that can drift again if there's ever a code path that updates one without the other.

3. **Validation only:** Add a constraint that rejects writes where `computer.siteId != kit.siteId` when both are non-null. This is the weakest option — it prevents new mismatches but doesn't handle the null case (Bug 2) unless you also require siteId to be non-null for kit members.

### Data migration

Regardless of approach, the 21 existing mismatched records need a one-time fix. If the kit site is the source of truth:

- Kit 1 computers (IDs 1–5): set `siteId` to 2 (Busboom)
- Kit 9 computers (IDs 40–45): set `siteId` to 3 (Alfred)
- Kit 10 computers (IDs 46–50): set `siteId` to 4 (Jed)
- Kit 11 computers (IDs 51–55): set `siteId` to 2 (Busboom)

Confirm with Eric whether the kit site or the computer site is correct for Kit 1 before running the migration — it's possible the kit was moved to Busboom but the computers stayed at Carmel Valley, or vice versa.