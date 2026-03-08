/**
 * One-time migration script: move bytea images from PostgreSQL to S3.
 *
 * For each Image record with `data` but no `objectKey`:
 *   1. Upload data to DigitalOcean Spaces
 *   2. Set objectKey on the record
 *   3. Clear the data column
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx ts-node src/scripts/migrate-images-to-s3.ts
 */

import { PrismaClient } from '@prisma/client';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { s3Client, DO_SPACES_BUCKET } from '../services/s3';

async function main() {
  const prisma = new PrismaClient();

  try {
    const images = await prisma.image.findMany({
      where: {
        data: { not: null },
        objectKey: null,
      },
      select: { id: true, data: true, mimeType: true, checksum: true },
    });

    console.log(`Found ${images.length} images to migrate.`);

    let migrated = 0;
    let failed = 0;

    for (const image of images) {
      try {
        if (!image.data) continue;

        const checksum = image.checksum || crypto.createHash('sha256').update(image.data).digest('hex');
        const ext = image.mimeType === 'image/webp' ? 'webp' : 'bin';
        const objectKey = `images/${checksum}.${ext}`;

        await s3Client.send(new PutObjectCommand({
          Bucket: DO_SPACES_BUCKET,
          Key: objectKey,
          Body: image.data,
          ContentType: image.mimeType,
          ACL: 'public-read',
        }));

        await prisma.image.update({
          where: { id: image.id },
          data: { objectKey, data: null },
        });

        migrated++;
        console.log(`  [${migrated}/${images.length}] Image ${image.id} → ${objectKey}`);
      } catch (err) {
        failed++;
        console.error(`  FAILED Image ${image.id}:`, err);
      }
    }

    console.log(`\nDone. Migrated: ${migrated}, Failed: ${failed}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
