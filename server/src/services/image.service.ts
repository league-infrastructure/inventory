import { PrismaClient } from '@prisma/client';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import crypto from 'crypto';
import { s3Client, DO_SPACES_BUCKET, SPACES_PUBLIC_URL } from './s3';

const MAX_DIMENSION = 1600;

const IMAGE_SELECT = {
  id: true, url: true, objectKey: true, fileName: true,
  mimeType: true, size: true, width: true, height: true, checksum: true,
} as const;

const IMAGE_META_SELECT = {
  ...IMAGE_SELECT,
  createdAt: true,
} as const;

export interface ImageRecord {
  id: number;
  url: string | null;
  objectKey: string | null;
  fileName: string | null;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  checksum: string;
}

export interface ImageMeta extends ImageRecord {
  createdAt: Date;
}

export interface ImageData {
  url: string | null;
  objectKey: string | null;
  data: Uint8Array | null;
  mimeType: string;
  checksum: string;
}

export class ImageService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Process raw image bytes: resize to max 1600px on longest side,
   * convert to WebP, compute metadata, and upload to S3.
   */
  async create(inputBuffer: Buffer, fileName?: string): Promise<ImageRecord> {
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
        fileName: fileName || null,
        mimeType: 'image/webp',
        size,
        width,
        height,
        checksum,
      },
      select: IMAGE_SELECT,
    });
  }

  /** Create an image record from a URL (no binary data stored). */
  async createFromUrl(url: string, fileName?: string): Promise<ImageRecord> {
    return this.prisma.image.create({
      data: { url, fileName: fileName || null },
      select: IMAGE_SELECT,
    });
  }

  /** List all images with metadata. Optional search by fileName. */
  async list(search?: string): Promise<ImageMeta[]> {
    return this.prisma.image.findMany({
      where: search ? { fileName: { contains: search, mode: 'insensitive' } } : undefined,
      select: IMAGE_META_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Get image metadata without binary data. */
  async getMeta(id: number): Promise<ImageMeta | null> {
    return this.prisma.image.findUnique({
      where: { id },
      select: IMAGE_META_SELECT,
    });
  }

  /** Get image serving info. */
  async getData(id: number): Promise<ImageData | null> {
    return this.prisma.image.findUnique({
      where: { id },
      select: { url: true, objectKey: true, data: true, mimeType: true, checksum: true },
    });
  }

  /** Build the public URL for an S3-stored image. */
  getPublicUrl(objectKey: string): string {
    return `${SPACES_PUBLIC_URL}/${objectKey}`;
  }

  /** Delete an image by ID, removing from S3 if applicable.
   *  Nulls out imageId on any linked computers, kits, or packs first. */
  async delete(id: number): Promise<void> {
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

    // Null out references before deleting
    await this.prisma.computer.updateMany({ where: { imageId: id }, data: { imageId: null } });
    await this.prisma.kit.updateMany({ where: { imageId: id }, data: { imageId: null } });
    await this.prisma.pack.updateMany({ where: { imageId: id }, data: { imageId: null } });

    await this.prisma.image.delete({ where: { id } });
  }

  /** Attach an image to a computer, kit, or pack. */
  async attach(imageId: number, objectType: 'Computer' | 'Kit' | 'Pack', objectId: number): Promise<void> {
    // Verify image exists
    const image = await this.prisma.image.findUnique({ where: { id: imageId } });
    if (!image) throw new Error(`Image ${imageId} not found`);

    switch (objectType) {
      case 'Computer':
        await this.prisma.computer.update({ where: { id: objectId }, data: { imageId } });
        break;
      case 'Kit':
        await this.prisma.kit.update({ where: { id: objectId }, data: { imageId } });
        break;
      case 'Pack':
        await this.prisma.pack.update({ where: { id: objectId }, data: { imageId } });
        break;
    }
  }

  /** Detach an image from a computer, kit, or pack (set imageId to null). */
  async detach(objectType: 'Computer' | 'Kit' | 'Pack', objectId: number): Promise<void> {
    switch (objectType) {
      case 'Computer':
        await this.prisma.computer.update({ where: { id: objectId }, data: { imageId: null } });
        break;
      case 'Kit':
        await this.prisma.kit.update({ where: { id: objectId }, data: { imageId: null } });
        break;
      case 'Pack':
        await this.prisma.pack.update({ where: { id: objectId }, data: { imageId: null } });
        break;
    }
  }
}
