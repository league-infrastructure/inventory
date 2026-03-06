# Inventory System MCP Server — Test Plan

**Date:** 2026-03-06
**Version:** 1.0
**Author:** Claude (test automation) / Eric Busboom

## Purpose

This test plan exercises the inventory management system through its MCP server API. The goal is to verify CRUD operations, business rules, data integrity constraints, and edge cases across all entity types.

## Data Model Summary

The system manages educational technology equipment through these entities:

- **Sites** — Physical locations where inventory is stored
- **Kits** — Named containers (bags, totes) assigned to a site or custodian, with a status lifecycle
- **Packs** — Sub-containers within kits for grouping non-computer items
- **Items** — Individual inventory items within packs (with expected quantities)
- **Computers** — Hardware tracked individually with serial numbers, hostnames, and kit/site assignments
- **Hostnames** — Named identifiers (CS pioneer names) assigned to computers
- **Operating Systems** — OS entries that can be assigned to computers
- **Transfers** — Kit and standalone computer transfers between sites/custodians

## Test Categories

### 1. Sites — CRUD and Constraints

| ID | Test | Method | Expected Result |
|----|------|--------|-----------------|
| S-01 | Create a site with all fields | `create_site` with name, address, lat, lon, isHomeSite | Site created with all fields populated |
| S-02 | Create a site with name only | `create_site` with name only | Site created, optional fields null |
| S-03 | Read site by ID | `get_site` | Returns full site record |
| S-04 | Update site fields | `update_site` — change name, add address | Fields updated |
| S-05 | Set isHomeSite flag | `update_site` with isHomeSite=true | Flag set; check if only one home site allowed |
| S-06 | Deactivate a site | `update_site` with isActive=false | Site deactivated |
| S-07 | Delete an active site with no kits | `delete_site` on active site | Should it require deactivation first? Test both |
| S-08 | Delete a deactivated site with no kits | `delete_site` | Site deleted |
| S-09 | Delete a site that has kits assigned | `delete_site` | Should fail — kits still reference it |
| S-10 | Create duplicate site name | `create_site` with existing name | Check if duplicates are allowed or rejected |
| S-11 | List sites after changes | `list_sites` | Returns only active sites (per tool description) |

### 2. Kits — CRUD, Status Lifecycle, and Constraints

| ID | Test | Method | Expected Result |
|----|------|--------|-----------------|
| K-01 | Create a kit with all fields | `create_kit` with number, name, siteId, containerType, description | Kit created, status defaults to ACTIVE |
| K-02 | Create a kit with minimal fields | `create_kit` with number, name, siteId only | Kit created |
| K-03 | Read kit by ID | `get_kit` | Returns kit with nested packs and computers |
| K-04 | Update kit fields | `update_kit` — change name, description, containerType | Fields updated |
| K-05 | Change kit status to MAINTENANCE | `update_kit` with status | Status changes |
| K-06 | Change kit status to RETIRED | `update_kit` with status | Status changes |
| K-07 | Change retired kit back to ACTIVE | `update_kit` with status=ACTIVE | Check if allowed |
| K-08 | List kits filtered by status | `list_kits` with status param | Returns only matching kits |
| K-09 | Delete a retired kit with no packs/computers | `delete_kit` | Kit deleted |
| K-10 | Delete a retired kit that still has computers | `delete_kit` | Should fail |
| K-11 | Delete an active kit | `delete_kit` | Should fail — must be retired first |
| K-12 | Create kit with duplicate number | `create_kit` | Check uniqueness enforcement |
| K-13 | Create kit with siteId for non-existent site | `create_kit` | Should fail with FK violation |
| K-14 | Move kit to different site via update | `update_kit` with new siteId | Check if allowed vs requiring transfer |
| K-15 | Kit with null siteId and custodian set | Verify kit 22 pattern | Custodian-held kits may have no site |

### 3. Packs — CRUD (Currently Unused in Production Data)

| ID | Test | Method | Expected Result |
|----|------|--------|-----------------|
| P-01 | Create a pack in an existing kit | `create_pack` with kitId, name | Pack created |
| P-02 | Create a pack with description | `create_pack` with kitId, name, description | Pack created with description |
| P-03 | List packs for a kit | `list_packs` with kitId | Returns packs in that kit |
| P-04 | Update pack name and description | `update_pack` | Fields updated |
| P-05 | Delete a pack with no items | `delete_pack` | Pack deleted |
| P-06 | Delete a pack that has items | `delete_pack` | Check if cascade or rejection |
| P-07 | Create pack in non-existent kit | `create_pack` with bad kitId | Should fail |
| P-08 | Create pack in retired kit | `create_pack` | Check if allowed |
| P-09 | List packs without kitId | `list_packs` with no param | API requires kitId — verify error message |

### 4. Items — CRUD (Currently Unused in Production Data)

| ID | Test | Method | Expected Result |
|----|------|--------|-----------------|
| I-01 | Create an item in a pack | `create_item` with packId, name, type | Item created |
| I-02 | Create item with expectedQuantity | `create_item` with all fields | Quantity stored |
| I-03 | List items for a pack | `list_items` with packId | Returns items in that pack |
| I-04 | Update item fields | `update_item` — change name, type, quantity | Fields updated |
| I-05 | Delete an item | `delete_item` | Item deleted |
| I-06 | Create item in non-existent pack | `create_item` with bad packId | Should fail |
| I-07 | Create item with zero or negative quantity | `create_item` | Check validation |
| I-08 | List items without packId | `list_items` with no param | Check behavior |

### 5. Computers — CRUD and Relationships

| ID | Test | Method | Expected Result |
|----|------|--------|-----------------|
| C-01 | Create a computer with all fields | `create_computer` with model, serial, serviceTag, osId, hostNameId, kitId, siteId, etc. | Computer created |
| C-02 | Create a computer with minimal fields | `create_computer` with no required fields (check what's actually required) | Check minimum requirements |
| C-03 | Read computer by ID | `get_computer` | Returns computer with nested hostname, site, kit, os, custodian |
| C-04 | Update computer fields | `update_computer` — change model, notes | Fields updated |
| C-05 | Assign OS to computer | `update_computer` with osId | OS linked |
| C-06 | Assign hostname to computer | `update_computer` with hostNameId | Hostname linked |
| C-07 | Assign computer to a kit | `update_computer` with kitId | Computer added to kit |
| C-08 | Remove computer from kit | `update_computer` with kitId=null | Computer becomes standalone |
| C-09 | Delete a computer | `delete_computer` | Computer deleted, hostname freed |
| C-10 | Create computer with duplicate serial number | `create_computer` | Check uniqueness |
| C-11 | Create computer referencing non-existent OS | `create_computer` with bad osId | Should fail |
| C-12 | Create computer referencing non-existent hostname | `create_computer` with bad hostNameId | Should fail |
| C-13 | Assign already-used hostname to different computer | `update_computer` | Should fail or reassign? |
| C-14 | Computer siteId vs kit siteId mismatch | Create computer at site A in kit at site B | Check if allowed — existing data shows this happens |
| C-15 | List all computers | `list_computers` | Returns all 101+ computers |

### 6. Hostnames — CRUD and Assignment

| ID | Test | Method | Expected Result |
|----|------|--------|-----------------|
| H-01 | Create a hostname | `create_hostname` with name | Hostname created, unassigned |
| H-02 | Create duplicate hostname | `create_hostname` with existing name | Check uniqueness |
| H-03 | Rename a hostname | `update_hostname` with new name | Name updated |
| H-04 | Delete an unassigned hostname | `delete_hostname` | Hostname deleted |
| H-05 | Delete an assigned hostname | `delete_hostname` on hostname with computerId | Should fail |
| H-06 | Hostname assignment via computer creation | `create_computer` with hostNameId | Hostname.computerId updated |
| H-07 | Hostname release on computer deletion | Delete computer, check hostname | computerId should be nulled |

### 7. Operating Systems — CRUD

| ID | Test | Method | Expected Result |
|----|------|--------|-----------------|
| O-01 | Create an operating system | `create_operating_system` with name | OS created |
| O-02 | Rename an operating system | `update_operating_system` | Name updated |
| O-03 | Delete an OS not assigned to any computers | `delete_operating_system` | OS deleted |
| O-04 | Delete an OS assigned to computers | `delete_operating_system` | Should fail |
| O-05 | Create duplicate OS name | `create_operating_system` | Check uniqueness |

### 8. Transfers — Kit and Computer Movement

| ID | Test | Method | Expected Result |
|----|------|--------|-----------------|
| T-01 | Transfer kit to a different site | `transfer_kit` with kitId, siteId | Kit.siteId updated |
| T-02 | Transfer kit to a custodian | `transfer_kit` with kitId, custodianId | Kit.custodianId set, siteId behavior? |
| T-03 | Transfer kit with notes | `transfer_kit` with notes | Notes recorded |
| T-04 | Transfer kit to non-existent site | `transfer_kit` with bad siteId | Should fail |
| T-05 | Transfer standalone computer to different site | `transfer_computer` with computerId, siteId | Computer.siteId updated |
| T-06 | Transfer computer that is in a kit | `transfer_computer` on kit-assigned computer | Should fail per tool description |
| T-07 | Transfer kit — do computers move too? | Transfer kit, check computer siteIds | Verify whether computers inherit kit's new site |
| T-08 | Transfer kit clearing custodian | Transfer to site, check custodianId | Should custodian be cleared? |

### 9. Cross-Cutting Concerns and Edge Cases

| ID | Test | Method | Expected Result |
|----|------|--------|-----------------|
| X-01 | Data consistency: computer.siteId vs kit.siteId | Query existing data | Document whether mismatch is valid or a bug |
| X-02 | Orphan cleanup: test/dup hostnames | Check hostnames with "Test" or "Dup" prefix | These are artifacts; can they be cleaned up? |
| X-03 | Kit with no site and no custodian | Create kit, clear both | Should this be allowed? |
| X-04 | Large batch operations | Create/update many records | Performance and error handling |
| X-05 | Invalid field types | Pass string for numeric field, etc. | Error handling quality |
| X-06 | Empty string vs null for optional fields | Create entities with "" vs omitted fields | Consistency check |
| X-07 | QR code generation | Check qrCode field on kits and computers | Verify format and uniqueness |
| X-08 | lastInventoried field | Check how it gets set | Is it manual or automatic? |
| X-09 | Concurrent modifications | (If testable) Update same record from two calls | Conflict handling |

## Test Execution Strategy

### Phase 1: Read-Only Verification
Run all list/get operations to verify the API returns consistent data and proper error messages for bad IDs.

### Phase 2: Create Operations
Create test entities in dependency order: Site → Kit → Pack → Item, plus OS → Hostname → Computer. Use distinctive names (prefixed with `TEST-`) for easy identification and cleanup.

### Phase 3: Update Operations
Modify the test entities, verifying field updates and relationship changes.

### Phase 4: Business Rule Testing
Test constraints: deletions with dependencies, status transitions, transfers, uniqueness rules.

### Phase 5: Edge Cases
Invalid inputs, boundary conditions, cross-entity consistency.

### Phase 6: Cleanup
Delete all TEST- prefixed entities in reverse dependency order.

## Test Data Naming Convention

All test-created entities will use the prefix `TEST-` to distinguish them from production data:
- Sites: `TEST-Site-Alpha`, `TEST-Site-Beta`
- Kits: `TEST-Kit-*` with numbers starting at 900
- Packs: `TEST-Pack-*`
- Items: `TEST-Item-*`
- Computers: serial numbers starting with `TEST-`
- Hostnames: `TEST-Host-*`
- Operating Systems: `TEST-OS-*`

## Deliverables

- **This test plan** — for repo documentation
- **Bug reports** — individual files in `docs/plans/todo/` for issues found
- **Enhancement suggestions** — individual files in `docs/plans/todo/` for improvement ideas
