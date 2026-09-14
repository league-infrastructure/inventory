/**
 * Follow-up regression test for sprint 010 ticket 001.
 *
 * Defect: ServiceRegistry picked SpacesFileStorage whenever
 * DO_SPACES_KEY/DO_SPACES_SECRET were present in process.env — which
 * they are on a developer machine with the project .env sourced (a
 * common setup, since token-auth suites need SESSION_SECRET from it).
 * That caused generated-file tests to upload real objects into the
 * production DigitalOcean Spaces bucket.
 *
 * Two independent guards now prevent this:
 *   1. tests/server/jest.setup-env.js (a jest `setupFiles` entry)
 *      deletes DO_SPACES_KEY/DO_SPACES_SECRET before any test file's
 *      own code runs.
 *   2. ServiceRegistry itself refuses to select SpacesFileStorage
 *      whenever NODE_ENV === 'test', regardless of what the
 *      credentials are set to.
 *
 * This file proves both, without ever touching real Spaces or a real
 * S3 client.
 */
import { getPrisma, teardown } from './setup';
import { ServiceRegistry } from '../../../server/src/services/service.registry';
import { DbFileStorage, SpacesFileStorage } from '../../../server/src/services/file-storage';
import * as s3 from '../../../server/src/services/s3';

describe('ServiceRegistry file storage selection guard', () => {
  const prisma = getPrisma();

  afterAll(async () => {
    await teardown();
  });

  it('guard 1: jest strips DO_SPACES_KEY/DO_SPACES_SECRET before this file runs', () => {
    // The verification command for this fix runs jest with
    // DO_SPACES_KEY=fake DO_SPACES_SECRET=fake exported in the shell
    // (simulating a developer's sourced .env). If jest.setup-env.js
    // did its job, this test file never sees those values — even
    // though the shell environment has them.
    expect(process.env.DO_SPACES_KEY).toBeUndefined();
    expect(process.env.DO_SPACES_SECRET).toBeUndefined();
  });

  it('guard 2: registry selects DbFileStorage under NODE_ENV=test even if a test re-sets Spaces credentials', () => {
    const originalKey = process.env.DO_SPACES_KEY;
    const originalSecret = process.env.DO_SPACES_SECRET;
    const originalNodeEnv = process.env.NODE_ENV;
    const getS3ClientSpy = jest.spyOn(s3, 'getS3Client');

    try {
      process.env.NODE_ENV = 'test';
      process.env.DO_SPACES_KEY = 'fake-key-simulating-inherited-shell-env';
      process.env.DO_SPACES_SECRET = 'fake-secret-simulating-inherited-shell-env';

      const registry = ServiceRegistry.create(prisma);

      expect(registry.fileStorage).toBeInstanceOf(DbFileStorage);
      expect(registry.fileStorage).not.toBeInstanceOf(SpacesFileStorage);
      // The decisive proof: no code path ever asked for a real S3
      // client, so no network call to Spaces could have happened.
      expect(getS3ClientSpy).not.toHaveBeenCalled();
    } finally {
      getS3ClientSpy.mockRestore();
      if (originalKey === undefined) delete process.env.DO_SPACES_KEY;
      else process.env.DO_SPACES_KEY = originalKey;
      if (originalSecret === undefined) delete process.env.DO_SPACES_SECRET;
      else process.env.DO_SPACES_SECRET = originalSecret;
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('sanity check: SpacesFileStorage IS selected when NODE_ENV is not "test" and credentials are present', () => {
    // Proves the production selection path is unchanged by the new
    // guard — this is the only case where SpacesFileStorage should
    // ever be constructed. It is never exercised against a real
    // network call here; the assertion only inspects the chosen type.
    const originalKey = process.env.DO_SPACES_KEY;
    const originalSecret = process.env.DO_SPACES_SECRET;
    const originalNodeEnv = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = 'production';
      process.env.DO_SPACES_KEY = 'fake-key';
      process.env.DO_SPACES_SECRET = 'fake-secret';

      const registry = ServiceRegistry.create(prisma);

      expect(registry.fileStorage).toBeInstanceOf(SpacesFileStorage);
    } finally {
      if (originalKey === undefined) delete process.env.DO_SPACES_KEY;
      else process.env.DO_SPACES_KEY = originalKey;
      if (originalSecret === undefined) delete process.env.DO_SPACES_SECRET;
      else process.env.DO_SPACES_SECRET = originalSecret;
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
