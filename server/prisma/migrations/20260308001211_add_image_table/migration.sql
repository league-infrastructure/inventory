-- AlterTable
ALTER TABLE "Computer" ADD COLUMN     "imageId" INTEGER;

-- AlterTable
ALTER TABLE "Kit" ADD COLUMN     "imageId" INTEGER;

-- AlterTable
ALTER TABLE "Pack" ADD COLUMN     "imageId" INTEGER;

-- CreateTable
CREATE TABLE "Image" (
    "id" SERIAL NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/webp',
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Computer_imageId_idx" ON "Computer"("imageId");

-- CreateIndex
CREATE INDEX "Kit_imageId_idx" ON "Kit"("imageId");

-- CreateIndex
CREATE INDEX "Pack_imageId_idx" ON "Pack"("imageId");

-- AddForeignKey
ALTER TABLE "Kit" ADD CONSTRAINT "Kit_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pack" ADD CONSTRAINT "Pack_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Computer" ADD CONSTRAINT "Computer_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;
