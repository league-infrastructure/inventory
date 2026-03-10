import { PrismaClient } from '@prisma/client';

export type JobHandler = () => Promise<void>;

export class SchedulerService {
  private prisma: PrismaClient;
  private handlers = new Map<string, JobHandler>();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  registerHandler(jobName: string, handler: JobHandler): void {
    this.handlers.set(jobName, handler);
  }

  async tick(): Promise<number> {
    let executed = 0;

    // Find all due jobs
    const dueJobs = await this.prisma.scheduledJob.findMany({
      where: {
        nextRunAt: { lte: new Date() },
        enabled: true,
      },
    });

    for (const job of dueJobs) {
      // Try to lock and execute each job in its own transaction
      try {
        await this.prisma.$transaction(async (tx) => {
          // Attempt row-level lock — skip if another process holds it
          const locked = await tx.$queryRaw<{ id: number }[]>`
            SELECT id FROM "ScheduledJob"
            WHERE id = ${job.id} AND "nextRunAt" <= NOW() AND enabled = true
            FOR UPDATE SKIP LOCKED
          `;

          if (locked.length === 0) return; // Another process has it

          const handler = this.handlers.get(job.name);
          if (!handler) {
            await tx.scheduledJob.update({
              where: { id: job.id },
              data: {
                lastError: `No handler registered for job "${job.name}"`,
                nextRunAt: this.computeNextRun(job.frequency, job.nextRunAt),
              },
            });
            return;
          }

          try {
            await handler();
            await tx.scheduledJob.update({
              where: { id: job.id },
              data: {
                lastRunAt: new Date(),
                lastError: null,
                nextRunAt: this.computeNextRun(job.frequency, job.nextRunAt),
              },
            });
            executed++;
            console.log(`Scheduled job "${job.name}" executed successfully`);
          } catch (err: any) {
            const errorMsg = err.message || String(err);
            await tx.scheduledJob.update({
              where: { id: job.id },
              data: {
                lastError: errorMsg,
                nextRunAt: this.computeNextRun(job.frequency, job.nextRunAt),
              },
            });
            console.error(`Scheduled job "${job.name}" failed:`, errorMsg);
          }
        });
      } catch (err: any) {
        // Transaction-level failure (e.g., connection lost) — log and continue
        console.error(`Scheduler transaction failed for "${job.name}":`, err.message);
      }
    }

    return executed;
  }

  async listJobs() {
    return this.prisma.scheduledJob.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async updateJob(id: number, data: { enabled?: boolean }): Promise<void> {
    await this.prisma.scheduledJob.update({
      where: { id },
      data,
    });
  }

  async runJobNow(id: number): Promise<void> {
    const job = await this.prisma.scheduledJob.findUnique({ where: { id } });
    if (!job) throw new Error(`Job ${id} not found`);

    const handler = this.handlers.get(job.name);
    if (!handler) throw new Error(`No handler for job "${job.name}"`);

    try {
      await handler();
      await this.prisma.scheduledJob.update({
        where: { id },
        data: { lastRunAt: new Date(), lastError: null },
      });
      console.log(`Scheduled job "${job.name}" executed manually`);
    } catch (err: any) {
      const errorMsg = err.message || String(err);
      await this.prisma.scheduledJob.update({
        where: { id },
        data: { lastError: errorMsg },
      });
      console.error(`Manual job execution failed for "${job.name}":`, errorMsg);
      throw err;
    }
  }

  private computeNextRun(frequency: string, currentNextRun: Date): Date {
    const next = new Date(currentNextRun);
    const now = new Date();

    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        // If still in the past (catching up), jump to tomorrow same time
        if (next <= now) {
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(next.getHours(), next.getMinutes(), 0, 0);
          return tomorrow;
        }
        return next;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        if (next <= now) {
          const nextWeek = new Date(now);
          nextWeek.setDate(nextWeek.getDate() + 7);
          nextWeek.setHours(next.getHours(), next.getMinutes(), 0, 0);
          return nextWeek;
        }
        return next;
      default:
        // Unknown frequency — add 24h as fallback
        next.setDate(next.getDate() + 1);
        return next;
    }
  }
}
