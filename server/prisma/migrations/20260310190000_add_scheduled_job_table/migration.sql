-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastError" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledJob_name_key" ON "ScheduledJob"("name");

-- Seed initial scheduled jobs
INSERT INTO "ScheduledJob" ("name", "description", "frequency", "nextRunAt", "updatedAt")
VALUES
    ('daily-backup', 'Automated daily database backup with dow-based rotation', 'daily',
     (CURRENT_DATE + 1) + TIME '02:00:00', CURRENT_TIMESTAMP),
    ('weekly-backup', 'Automated weekly database backup with 4-week retention', 'weekly',
     (CURRENT_DATE + (7 - EXTRACT(DOW FROM CURRENT_DATE)::int) % 7 + 7) + TIME '03:00:00', CURRENT_TIMESTAMP);
