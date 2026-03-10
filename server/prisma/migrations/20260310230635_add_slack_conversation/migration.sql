-- DropForeignKey
ALTER TABLE "Issue" DROP CONSTRAINT "Issue_itemId_fkey";

-- DropForeignKey
ALTER TABLE "Issue" DROP CONSTRAINT "Issue_packId_fkey";

-- CreateTable
CREATE TABLE "SlackConversation" (
    "id" SERIAL NOT NULL,
    "slackUserId" TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    "assistantMessage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlackConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlackConversation_slackUserId_createdAt_idx" ON "SlackConversation"("slackUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_packId_fkey" FOREIGN KEY ("packId") REFERENCES "Pack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
