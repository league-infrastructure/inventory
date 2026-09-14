import { getPrisma, getRegistry, setupTestUser, teardown, getSuffix } from './setup';
import { SchedulerService } from '../../../server/src/services/scheduler.service';
import { schedulerService as appSchedulerService } from '../../../server/src/app';

beforeAll(async () => { await setupTestUser(); });
afterAll(async () => {
  const prisma = getPrisma();
  await prisma.scheduledJob.deleteMany({ where: { name: { startsWith: 'test-' } } });
  await teardown();
});

describe('SchedulerService', () => {
  let service: SchedulerService;

  beforeAll(() => {
    service = new SchedulerService(getPrisma());
  });

  describe('tick()', () => {
    it('executes a due job and advances nextRunAt', async () => {
      const prisma = getPrisma();
      const job = await prisma.scheduledJob.create({
        data: {
          name: 'test-due-job',
          frequency: 'daily',
          nextRunAt: new Date(Date.now() - 60000), // 1 minute ago
          enabled: true,
        },
      });

      let handlerCalled = false;
      service.registerHandler('test-due-job', async () => { handlerCalled = true; });

      const executed = await service.tick();

      expect(handlerCalled).toBe(true);
      expect(executed).toBeGreaterThanOrEqual(1);

      const updated = await prisma.scheduledJob.findUnique({ where: { id: job.id } });
      expect(updated!.lastRunAt).not.toBeNull();
      expect(updated!.nextRunAt.getTime()).toBeGreaterThan(job.nextRunAt.getTime());
      expect(updated!.lastError).toBeNull();

      await prisma.scheduledJob.delete({ where: { id: job.id } });
    });

    it('skips jobs that are not yet due', async () => {
      const prisma = getPrisma();
      const job = await prisma.scheduledJob.create({
        data: {
          name: 'test-future-job',
          frequency: 'daily',
          nextRunAt: new Date(Date.now() + 3600000), // 1 hour from now
          enabled: true,
        },
      });

      let handlerCalled = false;
      service.registerHandler('test-future-job', async () => { handlerCalled = true; });

      await service.tick();

      expect(handlerCalled).toBe(false);

      await prisma.scheduledJob.delete({ where: { id: job.id } });
    });

    it('captures handler errors in lastError', async () => {
      const prisma = getPrisma();
      const job = await prisma.scheduledJob.create({
        data: {
          name: 'test-error-job',
          frequency: 'daily',
          nextRunAt: new Date(Date.now() - 60000),
          enabled: true,
        },
      });

      service.registerHandler('test-error-job', async () => {
        throw new Error('test failure');
      });

      await service.tick();

      const updated = await prisma.scheduledJob.findUnique({ where: { id: job.id } });
      expect(updated!.lastError).toBe('test failure');
      // nextRunAt should still advance even on failure
      expect(updated!.nextRunAt.getTime()).toBeGreaterThan(job.nextRunAt.getTime());

      await prisma.scheduledJob.delete({ where: { id: job.id } });
    });

    it('skips disabled jobs', async () => {
      const prisma = getPrisma();
      const job = await prisma.scheduledJob.create({
        data: {
          name: 'test-disabled-job',
          frequency: 'daily',
          nextRunAt: new Date(Date.now() - 60000),
          enabled: false,
        },
      });

      let handlerCalled = false;
      service.registerHandler('test-disabled-job', async () => { handlerCalled = true; });

      await service.tick();

      expect(handlerCalled).toBe(false);

      await prisma.scheduledJob.delete({ where: { id: job.id } });
    });
  });

  describe('listJobs()', () => {
    it('returns all jobs ordered by name', async () => {
      const jobs = await service.listJobs();
      expect(Array.isArray(jobs)).toBe(true);
      for (let i = 1; i < jobs.length; i++) {
        expect(jobs[i].name >= jobs[i - 1].name).toBe(true);
      }
    });
  });

  describe('updateJob()', () => {
    it('toggles enabled state', async () => {
      const prisma = getPrisma();
      const job = await prisma.scheduledJob.create({
        data: {
          name: 'test-toggle-job',
          frequency: 'daily',
          nextRunAt: new Date(Date.now() + 3600000),
          enabled: true,
        },
      });

      await service.updateJob(job.id, { enabled: false });
      const updated = await prisma.scheduledJob.findUnique({ where: { id: job.id } });
      expect(updated!.enabled).toBe(false);

      await prisma.scheduledJob.delete({ where: { id: job.id } });
    });
  });

  describe('runJobNow()', () => {
    it('executes a job immediately and updates lastRunAt', async () => {
      const prisma = getPrisma();
      const job = await prisma.scheduledJob.create({
        data: {
          name: 'test-manual-job',
          frequency: 'daily',
          nextRunAt: new Date(Date.now() + 3600000), // future
          enabled: true,
        },
      });

      let handlerCalled = false;
      service.registerHandler('test-manual-job', async () => { handlerCalled = true; });

      await service.runJobNow(job.id);

      expect(handlerCalled).toBe(true);
      const updated = await prisma.scheduledJob.findUnique({ where: { id: job.id } });
      expect(updated!.lastRunAt).not.toBeNull();
      expect(updated!.lastError).toBeNull();

      await prisma.scheduledJob.delete({ where: { id: job.id } });
    });

    it('throws for unknown job ID', async () => {
      await expect(service.runJobNow(999999)).rejects.toThrow('Job 999999 not found');
    });

    it('throws for job without handler', async () => {
      const prisma = getPrisma();
      const job = await prisma.scheduledJob.create({
        data: {
          name: 'test-no-handler-job',
          frequency: 'daily',
          nextRunAt: new Date(Date.now() + 3600000),
          enabled: true,
        },
      });

      await expect(service.runJobNow(job.id)).rejects.toThrow('No handler for job');

      await prisma.scheduledJob.delete({ where: { id: job.id } });
    });
  });
});

/**
 * Exercises the real `cleanup-generated-files` wiring: the actual
 * `schedulerService` singleton exported by `app.ts` (ticket 005 registers
 * the handler on it) and the actual `ScheduledJob` row seeded by ticket
 * 001's migration (`20260914052524_add_generated_file_storage`) — not a
 * throwaway `test-*` job like the isolated-instance tests above. Only
 * this one row's `nextRunAt` is ever moved into the past, and it is
 * restored afterward, so `daily-backup`/`weekly-backup` (registered on
 * the same singleton, backed by real Spaces calls) are never made due by
 * this test and are left untouched.
 */
describe('cleanup-generated-files (wired in app.ts)', () => {
  const suffix = getSuffix();
  const prisma = getPrisma();
  let ownerId: number;
  let original: { nextRunAt: Date; lastRunAt: Date | null; lastError: string | null };

  beforeAll(async () => {
    await setupTestUser();
    const owner = await prisma.user.create({
      data: {
        email: `sched-cleanup-owner-${suffix}@example.com`,
        googleId: `sched-cleanup-owner-${suffix}`,
        displayName: 'Scheduler Cleanup Owner',
        role: 'INSTRUCTOR',
      },
    });
    ownerId = owner.id;

    const job = await prisma.scheduledJob.findUniqueOrThrow({ where: { name: 'cleanup-generated-files' } });
    original = { nextRunAt: job.nextRunAt, lastRunAt: job.lastRunAt, lastError: job.lastError };
  });

  afterAll(async () => {
    // Restore the singleton job row so this test leaves no trace on the
    // shared dev database's real schedule.
    await prisma.scheduledJob.update({
      where: { name: 'cleanup-generated-files' },
      data: original,
    });
    await prisma.generatedFile.deleteMany({ where: { ownerId } });
    await prisma.user.delete({ where: { id: ownerId } });
    await teardown();
  });

  it('tick() deletes an expired GeneratedFile row and its backing object, and updates the job bookkeeping', async () => {
    const registry = getRegistry();
    const expired = await registry.generatedFiles.store(
      ownerId,
      Buffer.from('expired-export-bytes'),
      'expired-export.csv',
      'text/csv',
      -1000, // already expired
    );
    const live = await registry.generatedFiles.store(
      ownerId,
      Buffer.from('live-export-bytes'),
      'live-export.csv',
      'text/csv',
    );

    // Make the real seeded job due, without touching any other row.
    await prisma.scheduledJob.update({
      where: { name: 'cleanup-generated-files' },
      data: { nextRunAt: new Date(Date.now() - 60000) },
    });

    await appSchedulerService.tick();

    const expiredResolved = await registry.generatedFiles.resolveForDownload(expired.token, { id: ownerId, role: 'INSTRUCTOR' });
    expect(expiredResolved.outcome).toBe('not-found');
    const expiredRow = await prisma.generatedFile.findFirst({ where: { ownerId, filename: 'expired-export.csv' } });
    expect(expiredRow).toBeNull();

    // The backing blob is gone too, not just the row (DbFileStorage in
    // test/dev — no Spaces credentials configured).
    const liveRow = await prisma.generatedFile.findFirst({ where: { ownerId, filename: 'live-export.csv' } });
    expect(liveRow).not.toBeNull();

    const job = await prisma.scheduledJob.findUniqueOrThrow({ where: { name: 'cleanup-generated-files' } });
    expect(job.lastError).toBeNull();
    expect(job.lastRunAt).not.toBeNull();
    expect(job.nextRunAt.getTime()).toBeGreaterThan(Date.now());

    // Cross-check with the live file's own resolution, confirming the
    // acceptance criterion "a GeneratedFile row not yet past expiresAt is
    // left untouched by a tick() call".
    const liveResolved = await registry.generatedFiles.resolveForDownload(live.token, { id: ownerId, role: 'INSTRUCTOR' });
    expect(liveResolved.outcome).toBe('ok');
  });
});
