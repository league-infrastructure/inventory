-- CreateEnum
CREATE TYPE "ContainerType" AS ENUM ('BAG', 'LARGE_TOTE', 'SMALL_TOTE', 'DUFFEL');

-- AlterTable: add nullable columns first
ALTER TABLE "Kit" ADD COLUMN "number" INTEGER;
ALTER TABLE "Kit" ADD COLUMN "containerType" "ContainerType" NOT NULL DEFAULT 'BAG';

-- Backfill: parse existing kit names like "Bag 14 — HP Laptops"
-- Extract the number from the name (first integer after the container type word)
UPDATE "Kit" SET "number" = COALESCE(
  (regexp_match("name", '^\w+\s+(\d+)'))[1]::INTEGER,
  "id"
);

-- Make number required and unique
ALTER TABLE "Kit" ALTER COLUMN "number" SET NOT NULL;
CREATE UNIQUE INDEX "Kit_number_key" ON "Kit"("number");

-- Update name to just the descriptive part (after " — " or " - ")
UPDATE "Kit" SET "name" = CASE
  WHEN "name" ~ ' — ' THEN trim(substring("name" from ' — (.*)$'))
  WHEN "name" ~ ' - ' THEN trim(substring("name" from ' - (.*)$'))
  ELSE "name"
END;
