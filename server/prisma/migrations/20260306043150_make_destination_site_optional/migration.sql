-- DropForeignKey
ALTER TABLE "Checkout" DROP CONSTRAINT "Checkout_destinationSiteId_fkey";

-- AlterTable
ALTER TABLE "Checkout" ALTER COLUMN "destinationSiteId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Checkout" ADD CONSTRAINT "Checkout_destinationSiteId_fkey" FOREIGN KEY ("destinationSiteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
