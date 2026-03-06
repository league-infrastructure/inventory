-- CreateTable
CREATE TABLE "ComputerCheckout" (
    "id" SERIAL NOT NULL,
    "computerId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "destinationSiteId" INTEGER,
    "returnSiteId" INTEGER,
    "checkedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInAt" TIMESTAMP(3),

    CONSTRAINT "ComputerCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComputerCheckout_computerId_idx" ON "ComputerCheckout"("computerId");

-- CreateIndex
CREATE INDEX "ComputerCheckout_userId_idx" ON "ComputerCheckout"("userId");

-- AddForeignKey
ALTER TABLE "ComputerCheckout" ADD CONSTRAINT "ComputerCheckout_computerId_fkey" FOREIGN KEY ("computerId") REFERENCES "Computer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComputerCheckout" ADD CONSTRAINT "ComputerCheckout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComputerCheckout" ADD CONSTRAINT "ComputerCheckout_destinationSiteId_fkey" FOREIGN KEY ("destinationSiteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComputerCheckout" ADD CONSTRAINT "ComputerCheckout_returnSiteId_fkey" FOREIGN KEY ("returnSiteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
