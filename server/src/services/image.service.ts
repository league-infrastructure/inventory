import { PrismaClient } from '@prisma/client';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import crypto from 'crypto';
import { s3Client, DO_SPACES_BUCKET, SPACES_PUBLIC_URL } from './s3';

const MAX_DIMENSION = 1600;

export class ImageService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Process raw image bytes: resize to max 1600px on longest side,
   * convert to WebP, compute metadata, and upload to S3.
   */
  async create(inputBuffer: Buffer) {
    const processed = sharp(inputBuffer)
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 });

    const data = await processed.toBuffer();
    const metadata = await sharp(data).metadata();

    const width = metadata.width!;
    const height = metadata.height!;
    const size = data.length;
    const checksum = crypto.createHash('sha256').update(data).digest('hex');
    const objectKey = `images/${checksum}.webp`;

    await s3Client.send(new PutObjectCommand({
      Bucket: DO_SPACES_BUCKET,
      Key: objectKey,
      Body: data,
      ContentType: 'image/webp',
      ACL: 'public-read',
    }));

    return this.prisma.image.create({
      data: {
        objectKey,
        mimeType: 'image/webp',
        size,
        width,
        height,
        checksum,
      },
      select: { id: true, url: true, objectKey: true, mimeType: true, size: true, width: true, height: true, checksum: true },
    });
  }

  /** Create an image record from a URL (no binary data stored). */
  async createFromUrl(url: string) {
    return this.prisma.image.create({
      data: { url },
      select: { id: true, url: true, objectKey: true, mimeType: true, size: true, width: true, height: true, checksum: true },
    });
  }

  /** Get image metadata without binary data. */
  async getMeta(id: number) {
    return this.prisma.image.findUnique({
      where: { id },
      select: { id: true, url: true, objectKey: true, mimeType: true, size: true, width: true, height: true, checksum: true, createdAt: true },
    });
  }

  /** Get image serving info. */
  async getData(id: number) {
    return this.prisma.image.findUnique({
      where: { id },
      select: { url: true, objectKey: true, data: true, mimeType: true, checksum: true },
    });
  }

  /** Build the public URL for an S3-stored image. */
  getPublicUrl(objectKey: string): string {
    return `${SPACES_PUBLIC_URL}/${objectKey}`;
  }

  /** Delete an image by ID, removing from S3 if applicable. */
  async delete(id: number) {
    const image = await this.prisma.image.findUnique({
      where: { id },
      select: { objectKey: true },
    });

    if (image?.objectKey) {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: DO_SPACES_BUCKET,
        Key: image.objectKey,
      })).catch(() => {});
    }

    await this.prisma.image.delete({ where: { id } });
  }
}
