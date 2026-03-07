-- AlterTable
ALTER TABLE "User" ALTER COLUMN "googleId" DROP NOT NULL;

-- Clear fake googleIds (placeholder values start with "google-" or "test-google-")
UPDATE "User" SET "googleId" = NULL WHERE "googleId" LIKE 'google-%' OR "googleId" LIKE 'test-google-%';
