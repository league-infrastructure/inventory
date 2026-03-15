-- Rename defaultUsername/defaultPassword to adminUsername/adminPassword
ALTER TABLE "Computer" RENAME COLUMN "defaultUsername" TO "adminUsername";
ALTER TABLE "Computer" RENAME COLUMN "defaultPassword" TO "adminPassword";
