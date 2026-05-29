-- Data migration: backfill Manufacturer rows from the legacy
-- Computer.manufacturer string column and link Computer.manufacturerId.
--
-- Mirrors prisma/seed-manufacturer-backfill.ts so the migration runs
-- automatically on `prisma migrate deploy` instead of requiring a manual
-- ts-node invocation. Safe to re-run: ON CONFLICT and the IS NULL guard
-- make both steps idempotent.

-- 1. Upsert one Manufacturer row per distinct, title-cased string value.
INSERT INTO "Manufacturer" ("name", "createdAt", "updatedAt")
SELECT DISTINCT INITCAP(TRIM("manufacturer")), NOW(), NOW()
FROM "Computer"
WHERE "manufacturer" IS NOT NULL
  AND TRIM("manufacturer") <> ''
ON CONFLICT ("name") DO NOTHING;

-- 2. Link each Computer's manufacturerId to its Manufacturer row.
--    Only touch rows where manufacturerId is still NULL — preserves any
--    explicit assignments already in place.
UPDATE "Computer" c
SET "manufacturerId" = m."id"
FROM "Manufacturer" m
WHERE c."manufacturerId" IS NULL
  AND c."manufacturer" IS NOT NULL
  AND TRIM(c."manufacturer") <> ''
  AND m."name" = INITCAP(TRIM(c."manufacturer"));
