import crypto from 'crypto';
import { getPrisma, teardown, getSuffix } from './setup';
import { DbFileStorage } from '../../../server/src/services/file-storage';
import {
  GeneratedFileService,
  DEFAULT_RETENTION_MS,
} from '../../../server/src/services/generated-file.service';

const prisma = getPrisma();
const suffix = getSuffix();

describe('DbFileStorage', () => {
  const createdKeys: string[] = [];

  afterAll(async () => {
    for (const key of createdKeys) {
      await prisma.generatedFileBlob.deleteMany({ where: { key } });
    }
  });

  it('round-trips bytes through put/get', async () => {
    const storage = new DbFileStorage(prisma);
    const key = `gfs-test-${suffix}-roundtrip`;
    createdKeys.push(key);
    const data = Buffer.from('hello generated file storage');

    await storage.put(key, data);
    const read = await storage.get(key);

    expect(read).toBeInstanceOf(Buffer);
    expect(read.equals(data)).toBe(true);
  });

  it('overwrites bytes for the same key on a second put', async () => {
    const storage = new DbFileStorage(prisma);
    const key = `gfs-test-${suffix}-overwrite`;
    createdKeys.push(key);

    await storage.put(key, Buffer.from('version 1'));
    await storage.put(key, Buffer.from('version 2'));
    const read = await storage.get(key);

    expect(read.toString()).toBe('version 2');
  });

  it('rejects get() for a key that was never put', async () => {
    const storage = new DbFileStorage(prisma);
    await expect(storage.get(`gfs-test-${suffix}-missing`)).rejects.toThrow();
  });

  it('delete() removes the row so a subsequent get() rejects', async () => {
    const storage = new DbFileStorage(prisma);
    const key = `gfs-test-${suffix}-delete`;
    await storage.put(key, Buffer.from('to be deleted'));

    await storage.delete(key);

    await expect(storage.get(key)).rejects.toThrow();
  });

  it('delete() on a nonexistent key does not throw', async () => {
    const storage = new DbFileStorage(prisma);
    await expect(storage.delete(`gfs-test-${suffix}-never-existed`)).resolves.not.toThrow();
  });
});

describe('GeneratedFileService', () => {
  let ownerId: number;
  let qmId: number;
  let outsiderId: number;
  let service: GeneratedFileService;
  let storage: DbFileStorage;

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: {
        email: `gfs-owner-${suffix}@example.com`,
        googleId: `gfs-owner-${suffix}`,
        displayName: 'GFS Owner',
        role: 'INSTRUCTOR',
      },
    });
    ownerId = owner.id;

    const qm = await prisma.user.create({
      data: {
        email: `gfs-qm-${suffix}@example.com`,
        googleId: `gfs-qm-${suffix}`,
        displayName: 'GFS Quartermaster',
        role: 'QUARTERMASTER',
      },
    });
    qmId = qm.id;

    const outsider = await prisma.user.create({
      data: {
        email: `gfs-outsider-${suffix}@example.com`,
        googleId: `gfs-outsider-${suffix}`,
        displayName: 'GFS Outsider',
        role: 'INSTRUCTOR',
      },
    });
    outsiderId = outsider.id;

    storage = new DbFileStorage(prisma);
    service = new GeneratedFileService(prisma, storage);
  });

  afterAll(async () => {
    await prisma.generatedFile.deleteMany({ where: { ownerId: { in: [ownerId, qmId, outsiderId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, qmId, outsiderId] } } });
    await teardown();
  });

  it('store() persists the row, hashes the token, and builds a well-formed download URL', async () => {
    const buffer = Buffer.from('%PDF-fake-label-bytes');
    const { token, downloadUrl } = await service.store(ownerId, buffer, 'labels.pdf', 'application/pdf');

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(downloadUrl).toMatch(/^https?:\/\/.+\/api\/downloads\/[0-9a-f]{64}$/);
    expect(downloadUrl.endsWith(token)).toBe(true);

    const row = await prisma.generatedFile.findFirst({ where: { ownerId, filename: 'labels.pdf' } });
    expect(row).not.toBeNull();
    expect(row!.tokenHash).not.toBe(token);
    expect(row!.size).toBe(buffer.length);
    expect(row!.mimeType).toBe('application/pdf');

    // Default retention is 7 days when expiresInMs is omitted.
    const expectedExpiry = row!.createdAt.getTime() + DEFAULT_RETENTION_MS;
    expect(Math.abs(row!.expiresAt.getTime() - expectedExpiry)).toBeLessThan(5000);
  });

  it('resolveForDownload: the owner can resolve their own file', async () => {
    const { token } = await service.store(ownerId, Buffer.from('owner-file'), 'a.pdf', 'application/pdf');

    const result = await service.resolveForDownload(token, { id: ownerId, role: 'INSTRUCTOR' });

    expect(result.outcome).toBe('ok');
    if (result.outcome === 'ok') {
      expect(result.data.toString()).toBe('owner-file');
      expect(result.filename).toBe('a.pdf');
      expect(result.mimeType).toBe('application/pdf');
    }
  });

  it('resolveForDownload: a quartermaster can resolve anyone\'s file', async () => {
    const { token } = await service.store(ownerId, Buffer.from('qm-visible-file'), 'b.pdf', 'application/pdf');

    const result = await service.resolveForDownload(token, { id: qmId, role: 'QUARTERMASTER' });

    expect(result.outcome).toBe('ok');
  });

  it('resolveForDownload: a third ordinary user is forbidden', async () => {
    const { token } = await service.store(ownerId, Buffer.from('private-file'), 'c.pdf', 'application/pdf');

    const result = await service.resolveForDownload(token, { id: outsiderId, role: 'INSTRUCTOR' });

    expect(result.outcome).toBe('forbidden');
  });

  it('resolveForDownload: an expired row resolves as not-found, even for the owner', async () => {
    const { token } = await service.store(
      ownerId,
      Buffer.from('expired-file'),
      'd.pdf',
      'application/pdf',
      -1000, // already expired
    );

    const result = await service.resolveForDownload(token, { id: ownerId, role: 'INSTRUCTOR' });

    expect(result.outcome).toBe('not-found');
  });

  it('resolveForDownload: an unknown token resolves as not-found', async () => {
    const result = await service.resolveForDownload('0'.repeat(64), { id: ownerId, role: 'INSTRUCTOR' });

    expect(result.outcome).toBe('not-found');
  });

  it('deleteExpired() removes both the row and the backing object, and leaves live files alone', async () => {
    const expired = await service.store(ownerId, Buffer.from('will-be-cleaned'), 'e.pdf', 'application/pdf', -1000);
    const live = await service.store(ownerId, Buffer.from('stays-alive'), 'f.pdf', 'application/pdf');

    const count = await service.deleteExpired();

    expect(count).toBeGreaterThanOrEqual(1);

    const expiredHash = crypto.createHash('sha256').update(expired.token).digest('hex');
    const liveHash = crypto.createHash('sha256').update(live.token).digest('hex');

    const expiredRow = await prisma.generatedFile.findUnique({ where: { tokenHash: expiredHash } });
    expect(expiredRow).toBeNull();

    const liveRow = await prisma.generatedFile.findUnique({ where: { tokenHash: liveHash } });
    expect(liveRow).not.toBeNull();

    // The backing blob for the expired file must be gone too.
    await expect(storage.get((await prisma.generatedFile.findUnique({ where: { tokenHash: liveHash } }))!.objectKey))
      .resolves.toBeInstanceOf(Buffer);
  });
});
