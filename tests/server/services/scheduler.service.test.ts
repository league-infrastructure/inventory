import { getPrisma, setupTestUser, teardown } from './setup';
import { SchedulerService } from '../../../server/src/services/scheduler.service';

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
