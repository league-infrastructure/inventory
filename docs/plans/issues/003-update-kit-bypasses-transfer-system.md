# Bug: update_kit allows siteId change without transfer record

**Date:** 2026-03-07
**Severity:** Medium — audit trail gap
**Found by:** MCP test plan execution (test K-14)

## Description

Calling `update_kit` with a new `siteId` directly changes the kit's site
without creating a Transfer record. This bypasses the transfer system and
leaves no audit trail of the move.

The site cascade to member computers works correctly (computers follow the
kit), but there is no transfer record documenting when or why the kit
moved.

## Steps to reproduce

1. Create a kit at site A
2. Call `update_kit` with `siteId` pointing to site B
3. Kit moves to site B, computers cascade — but no Transfer record exists

## Expected behavior

Either:
- `update_kit` should reject `siteId` changes and require using
  `transfer_kit` instead, **or**
- `update_kit` should automatically create a Transfer record when `siteId`
  changes

## Impact

An MCP client or API consumer can move kits between sites without any
record in the transfers table. This defeats the purpose of the transfer
audit trail.

## Recommended fix

Option A (stricter): Remove `siteId` from `update_kit`'s accepted fields.
Site changes must go through `transfer_kit`.

Option B (permissive): Keep `siteId` in `update_kit` but auto-create a
Transfer record when it changes, similar to how the service already
cascades to computers.
