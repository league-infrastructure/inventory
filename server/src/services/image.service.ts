import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import crypto from 'crypto';

const MAX_DIMENSION = 1600;

export class ImageService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Process raw image bytes: resize to max 1600px on longest side,
   * convert to WebP, compute metadata, and store in database.
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

    return this.prisma.image.create({
      data: {
        data,
        mimeType: 'image/webp',
        size,
        width,
        height,
        checksum,
      },
      select: { id: true, url: true, mimeType: true, size: true, width: true, height: true, checksum: true },
    });
  }

  /** Create an image record from a URL (no binary data stored). */
  async createFromUrl(url: string) {
    return this.prisma.image.create({
      data: { url },
      select: { id: true, url: true, mimeType: true, size: true, width: true, height: true, checksum: true },
    });
  }

  /** Get image metadata without binary data. */
  async getMeta(id: number) {
    return this.prisma.image.findUnique({
      where: { id },
      select: { id: true, url: true, mimeType: true, size: true, width: true, height: true, checksum: true, createdAt: true },
    });
  }

  /** Get full image including binary data for serving. */
  async getData(id: number) {
    return this.prisma.image.findUnique({
      where: { id },
      select: { url: true, data: true, mimeType: true, checksum: true },
    });
  }

  /** Delete an image by ID. */
  async delete(id: number) {
    await this.prisma.image.delete({ where: { id } });
  }
}
