import { PrismaClient } from '@prisma/client';
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getS3Client, DO_SPACES_BUCKET } from './s3';
import { NotFoundError } from './errors';

/**
 * Stores and retrieves opaque bytes by key. Knows nothing about
 * ownership, tokens, expiry, or MIME semantics beyond passthrough —
 * see sprint 010 sprint.md Step 3 for the boundary rationale.
 */
export interface FileStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/**
 * Production backend: private objects in the existing DigitalOcean
 * Spaces bucket, under a `generated-files/` prefix — separate from
 * `ImageService`'s `images/` prefix. Unlike `ImageService`'s uploads,
 * these are never written with `ACL: 'public-read'`; access is gated
 * entirely by `GeneratedFileService`/the download route, not by the
 * object's own ACL.
 */
export class SpacesFileStorage implements FileStorage {
  private readonly prefix = 'generated-files/';

  async put(key: string, data: Buffer): Promise<void> {
    await getS3Client().send(new PutObjectCommand({
      Bucket: DO_SPACES_BUCKET,
      Key: this.prefix + key,
      Body: data,
    }));
  }

  async get(key: string): Promise<Buffer> {
    const result = await getS3Client().send(new GetObjectCommand({
      Bucket: DO_SPACES_BUCKET,
      Key: this.prefix + key,
    }));

    if (!result.Body) {
      throw new NotFoundError(`No object body for key ${key}`);
    }

    const bytes = await result.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async delete(key: string): Promise<void> {
    await getS3Client().send(new DeleteObjectCommand({
      Bucket: DO_SPACES_BUCKET,
      Key: this.prefix + key,
    }));
  }
}

/**
 * Dev/test fallback: bytes live in a dedicated `GeneratedFileBlob`
 * table (one row per key) rather than a `data Bytes` column directly
 * on `GeneratedFile`. Kept as its own table — not folded into
 * `GeneratedFile` — so this class stays a pure key/bytes store with no
 * knowledge of `GeneratedFile`'s columns (ownership, token, expiry),
 * matching the `FileStorage` interface's boundary. Selected whenever
 * `DO_SPACES_KEY`/`DO_SPACES_SECRET` are not both set (composition
 * root: `ServiceRegistry`), so no test in this sprint needs real
 * Spaces credentials.
 */
export class DbFileStorage implements FileStorage {
  constructor(private prisma: PrismaClient) {}

  async put(key: string, data: Buffer): Promise<void> {
    await this.prisma.generatedFileBlob.upsert({
      where: { key },
      create: { key, data },
      update: { data },
    });
  }

  async get(key: string): Promise<Buffer> {
    const row = await this.prisma.generatedFileBlob.findUnique({ where: { key } });
    if (!row) {
      throw new NotFoundError(`No stored blob for key ${key}`);
    }
    return Buffer.from(row.data);
  }

  async delete(key: string): Promise<void> {
    await this.prisma.generatedFileBlob.deleteMany({ where: { key } });
  }
}
