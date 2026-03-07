# Bug: Duplicate computer serial numbers allowed

**Date:** 2026-03-07
**Severity:** Medium — data integrity issue
**Found by:** MCP test plan execution (test C-10)

## Description

Creating multiple computers with the same `serialNumber` succeeds without
error. Serial numbers should be unique identifiers for hardware.

## Steps to reproduce

1. `create_computer` with `serialNumber: "ABC123"`
2. `create_computer` with `serialNumber: "ABC123"` — succeeds, creating a
   duplicate

## Expected behavior

Second create should fail with a validation error like "Serial number
already exists".

## Root cause

The Prisma schema does not have a `@unique` constraint on
`Computer.serialNumber`, and the service layer does not check for
duplicates.

## Fix options

1. **Schema constraint (preferred):** Add `@unique` to `serialNumber` in
   `schema.prisma`. This requires a migration and handling the case where
   `serialNumber` is null (multiple null values should be allowed).
2. **Service-level check:** Add a `findFirst` check in
   `ComputerService.create()` when `serialNumber` is non-null.

## Note

`serviceTag` likely has the same issue — it should also be unique when
non-null.
