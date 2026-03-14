-- AlterTable
ALTER TABLE "Computer" ADD COLUMN     "studentPassword" TEXT,
ADD COLUMN     "studentUsername" TEXT;

-- Populate existing records with default student credentials
UPDATE "Computer" SET "studentUsername" = 'student', "studentPassword" = 'student' WHERE "studentUsername" IS NULL;
