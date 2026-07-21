-- Add Pack.displayNumber: a persisted, per-kit-unique display number
-- ("pack 1, 2, 3...") distinct from Pack.id.
--
-- Three-step migration so the NOT NULL + unique constraint never rejects
-- an existing row:
--   1. Add the column as nullable.
--   2. Backfill every existing pack via a windowed UPDATE, dense-ranking
--      per kitId ordered by id ASC (matches label.service.ts's existing
--      ad hoc getPackSequence() order, so already-printed labels stay
--      numerically consistent immediately after this migration).
--   3. Enforce NOT NULL and add the per-kit unique index.

-- 1. Add as nullable.
ALTER TABLE "Pack" ADD COLUMN "displayNumber" INTEGER;

-- 2. Backfill: dense rank per kit, ordered by id ASC.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "kitId" ORDER BY "id" ASC) AS rn
  FROM "Pack"
)
UPDATE "Pack" p
SET "displayNumber" = ranked."rn"
FROM ranked
WHERE p."id" = ranked."id";

-- 3. Enforce NOT NULL and per-kit uniqueness.
ALTER TABLE "Pack" ALTER COLUMN "displayNumber" SET NOT NULL;
CREATE UNIQUE INDEX "Pack_kitId_displayNumber_key" ON "Pack"("kitId", "displayNumber");
