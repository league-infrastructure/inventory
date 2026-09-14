import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { FileStorage } from './file-storage';
import { getBaseUrl } from '../config/baseUrl';
import { hasQMAccess } from '../contracts';

/** Default retention window when `store()` is not given `expiresInMs`. */
export const DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface StoreResult {
  /** Raw, unhashed token — the only place this value ever exists outside a URL. */
  token: string;
  downloadUrl: string;
}

export interface RequestingUser {
  id: number;
  role: string;
}

/**
 * Outcome of resolving a raw download token. A union rather than
 * thrown errors, so callers (the ticket 002 download route) can map
 * each case to the right HTTP response without string-matching error
 * messages. `not-found` also covers expired rows — see
 * `resolveForDownload` below for why that must not be distinguishable
 * from a token that never existed.
 */
export type DownloadResolution =
  | { outcome: 'not-found' }
  | { outcome: 'forbidden' }
  | { outcome: 'ok'; data: Buffer; filename: string; mimeType: string };

/**
 * The only thing later tickets in sprint 010 call to persist a
 * generated file and mint/resolve its download link. Delegates byte
 * I/O to `FileStorage` and the owner-or-quartermaster access check to
 * `hasQMAccess` — knows nothing about PDFs, CSVs, labels, or exports.
 */
export class GeneratedFileService {
  constructor(private prisma: PrismaClient, private fileStorage: FileStorage) {}

  /**
   * Persists `buffer` via `FileStorage`, creates the `GeneratedFile`
   * row, and returns a raw download token plus the absolute URL it
   * resolves to. Only the token's sha256 hash is ever persisted —
   * matching `token.service.ts`'s `ApiToken` pattern — so a leaked DB
   * row cannot be replayed as a working download link.
   */
  async store(
    ownerId: number,
    buffer: Buffer,
    filename: string,
    mimeType: string,
    expiresInMs: number = DEFAULT_RETENTION_MS,
  ): Promise<StoreResult> {
    const objectKey = crypto.randomUUID();
    await this.fileStorage.put(objectKey, buffer);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.generatedFile.create({
      data: {
        ownerId,
        filename,
        mimeType,
        size: buffer.length,
        objectKey,
        tokenHash,
        expiresAt: new Date(Date.now() + expiresInMs),
      },
    });

    const base = getBaseUrl().replace(/\/+$/, '');
    return { token: rawToken, downloadUrl: `${base}/api/downloads/${rawToken}` };
  }

  /**
   * Hashes `rawToken`, looks up the matching `GeneratedFile` row, and
   * decides whether `requestingUser` may download it. An expired row
   * is treated identically to a nonexistent one — checked before the
   * ownership/QM check — so a requester learns nothing about whether
   * an expired token ever belonged to someone else.
   */
  async resolveForDownload(rawToken: string, requestingUser: RequestingUser): Promise<DownloadResolution> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const row = await this.prisma.generatedFile.findUnique({ where: { tokenHash } });

    if (!row || row.expiresAt < new Date()) {
      return { outcome: 'not-found' };
    }

    if (row.ownerId !== requestingUser.id && !hasQMAccess(requestingUser.role)) {
      return { outcome: 'forbidden' };
    }

    const data = await this.fileStorage.get(row.objectKey);
    return { outcome: 'ok', data, filename: row.filename, mimeType: row.mimeType };
  }

  /**
   * Deletes every `GeneratedFile` row past its `expiresAt`, along with
   * its backing object, and returns how many were removed. Wired to
   * the `cleanup-generated-files` scheduled job by ticket 005.
   */
  async deleteExpired(): Promise<number> {
    const expired = await this.prisma.generatedFile.findMany({
      where: { expiresAt: { lt: new Date() } },
    });

    for (const row of expired) {
      await this.fileStorage.delete(row.objectKey);
    }

    if (expired.length > 0) {
      await this.prisma.generatedFile.deleteMany({
        where: { id: { in: expired.map((row) => row.id) } },
      });
    }

    return expired.length;
  }
}
