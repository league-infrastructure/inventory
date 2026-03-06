-- AlterTable
ALTER TABLE "Computer" ADD COLUMN     "osId" INTEGER;

-- CreateTable
CREATE TABLE "OperatingSystem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatingSystem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperatingSystem_name_key" ON "OperatingSystem"("name");

-- CreateIndex
CREATE INDEX "Computer_osId_idx" ON "Computer"("osId");

-- AddForeignKey
ALTER TABLE "Computer" ADD CONSTRAINT "Computer_osId_fkey" FOREIGN KEY ("osId") REFERENCES "OperatingSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
