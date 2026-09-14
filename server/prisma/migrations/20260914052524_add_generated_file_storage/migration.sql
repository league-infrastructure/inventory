-- CreateTable
CREATE TABLE "GeneratedFile" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "objectKey" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedFileBlob" (
    "key" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedFileBlob_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedFile_tokenHash_key" ON "GeneratedFile"("tokenHash");

-- CreateIndex
CREATE INDEX "GeneratedFile_ownerId_idx" ON "GeneratedFile"("ownerId");

-- CreateIndex
CREATE INDEX "GeneratedFile_expiresAt_idx" ON "GeneratedFile"("expiresAt");

-- AddForeignKey
ALTER TABLE "GeneratedFile" ADD CONSTRAINT "GeneratedFile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the cleanup-generated-files scheduled job. Handler is registered
-- on SchedulerService in ticket 005; this row exists from the start
-- (same pattern as 20260310190000_add_scheduled_job_table's
-- daily-backup/weekly-backup rows) so that ticket has something to
-- register against without its own migration.
INSERT INTO "ScheduledJob" ("name", "description", "frequency", "nextRunAt", "updatedAt")
VALUES
    ('cleanup-generated-files', 'Deletes expired GeneratedFile rows and their backing storage objects', 'daily',
     (CURRENT_DATE + 1) + TIME '04:00:00', CURRENT_TIMESTAMP);
