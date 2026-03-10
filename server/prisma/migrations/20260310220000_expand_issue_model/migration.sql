-- AlterEnum
ALTER TYPE "IssueType" ADD VALUE 'DAMAGE';
ALTER TYPE "IssueType" ADD VALUE 'MAINTENANCE';
ALTER TYPE "IssueType" ADD VALUE 'OTHER';

-- AlterTable: make packId and itemId optional, add kitId and computerId
ALTER TABLE "Issue" ALTER COLUMN "packId" DROP NOT NULL;
ALTER TABLE "Issue" ALTER COLUMN "itemId" DROP NOT NULL;
ALTER TABLE "Issue" ADD COLUMN "kitId" INTEGER;
ALTER TABLE "Issue" ADD COLUMN "computerId" INTEGER;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "Kit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_computerId_fkey" FOREIGN KEY ("computerId") REFERENCES "Computer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Issue_kitId_idx" ON "Issue"("kitId");
CREATE INDEX "Issue_computerId_idx" ON "Issue"("computerId");
