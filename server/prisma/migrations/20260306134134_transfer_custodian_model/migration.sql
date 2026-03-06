-- DropForeignKey
ALTER TABLE "Checkout" DROP CONSTRAINT "Checkout_destinationSiteId_fkey";

-- DropForeignKey
ALTER TABLE "Checkout" DROP CONSTRAINT "Checkout_kitId_fkey";

-- DropForeignKey
ALTER TABLE "Checkout" DROP CONSTRAINT "Checkout_returnSiteId_fkey";

-- DropForeignKey
ALTER TABLE "Checkout" DROP CONSTRAINT "Checkout_userId_fkey";

-- DropForeignKey
ALTER TABLE "ComputerCheckout" DROP CONSTRAINT "ComputerCheckout_computerId_fkey";

-- DropForeignKey
ALTER TABLE "ComputerCheckout" DROP CONSTRAINT "ComputerCheckout_destinationSiteId_fkey";

-- DropForeignKey
ALTER TABLE "ComputerCheckout" DROP CONSTRAINT "ComputerCheckout_returnSiteId_fkey";

-- DropForeignKey
ALTER TABLE "ComputerCheckout" DROP CONSTRAINT "ComputerCheckout_userId_fkey";

-- DropForeignKey
ALTER TABLE "Kit" DROP CONSTRAINT "Kit_siteId_fkey";

-- AlterTable
ALTER TABLE "Computer" ADD COLUMN     "custodianId" INTEGER;

-- AlterTable
ALTER TABLE "Kit" ADD COLUMN     "custodianId" INTEGER,
ALTER COLUMN "siteId" DROP NOT NULL;

-- DropTable
DROP TABLE "Checkout";

-- DropTable
DROP TABLE "ComputerCheckout";

-- CreateTable
CREATE TABLE "Transfer" (
    "id" SERIAL NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "fromCustodian" TEXT,
    "toCustodian" TEXT,
    "fromSiteId" INTEGER,
    "toSiteId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transfer_objectType_objectId_idx" ON "Transfer"("objectType", "objectId");

-- CreateIndex
CREATE INDEX "Transfer_userId_idx" ON "Transfer"("userId");

-- CreateIndex
CREATE INDEX "Transfer_createdAt_idx" ON "Transfer"("createdAt");

-- CreateIndex
CREATE INDEX "Computer_custodianId_idx" ON "Computer"("custodianId");

-- CreateIndex
CREATE INDEX "Kit_custodianId_idx" ON "Kit"("custodianId");

-- AddForeignKey
ALTER TABLE "Kit" ADD CONSTRAINT "Kit_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kit" ADD CONSTRAINT "Kit_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Computer" ADD CONSTRAINT "Computer_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
