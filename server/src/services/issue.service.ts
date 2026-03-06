import { PrismaClient } from '@prisma/client';
import { AuditService } from './audit.service';
import { NotFoundError, ValidationError } from './errors';
import { IssueRecord, CreateIssueInput, ResolveIssueInput } from '../contracts';

const ISSUE_INCLUDES = {
  pack: { select: { id: true, name: true } },
  item: { select: { id: true, name: true } },
  reporter: { select: { id: true, displayName: true } },
  resolver: { select: { id: true, displayName: true } },
};

function toRecord(issue: any): IssueRecord {
  return {
    ...issue,
    createdAt: issue.createdAt instanceof Date ? issue.createdAt.toISOString() : issue.createdAt,
    updatedAt: issue.updatedAt instanceof Date ? issue.updatedAt.toISOString() : issue.updatedAt,
    resolvedAt: issue.resolvedAt instanceof Date ? issue.resolvedAt.toISOString() : issue.resolvedAt,
  };
}

const VALID_TYPES = ['MISSING_ITEM', 'REPLENISHMENT'];

export class IssueService {
  private prisma: PrismaClient;
  private audit: AuditService;

  constructor(prisma: PrismaClient, audit: AuditService) {
    this.prisma = prisma;
    this.audit = audit;
  }

  async list(filters?: { status?: string; packId?: number; type?: string }): Promise<IssueRecord[]> {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.packId) where.packId = filters.packId;
    if (filters?.type) where.type = filters.type;

    const issues = await this.prisma.issue.findMany({
      where,
      include: ISSUE_INCLUDES,
      orderBy: { createdAt: 'desc' },
    });
    return issues.map(toRecord);
  }

  async get(id: number): Promise<IssueRecord> {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: ISSUE_INCLUDES,
    });
    if (!issue) throw new NotFoundError('Issue not found');
    return toRecord(issue);
  }

  async create(input: CreateIssueInput, userId: number): Promise<IssueRecord> {
    if (!VALID_TYPES.includes(input.type)) {
      throw new ValidationError(`Invalid issue type: ${input.type}. Must be MISSING_ITEM or REPLENISHMENT`);
    }

    const pack = await this.prisma.pack.findUnique({ where: { id: input.packId } });
    if (!pack) throw new NotFoundError('Pack not found');

    const item = await this.prisma.item.findUnique({ where: { id: input.itemId } });
    if (!item) throw new NotFoundError('Item not found');
    if (item.packId !== input.packId) {
      throw new ValidationError('Item does not belong to the specified pack');
    }

    const issue = await this.prisma.issue.create({
      data: {
        type: input.type as any,
        packId: input.packId,
        itemId: input.itemId,
        reporterId: userId,
        notes: input.notes || null,
      },
      include: ISSUE_INCLUDES,
    });

    await this.audit.write({
      userId,
      objectType: 'Issue',
      objectId: issue.id,
      field: 'created',
      oldValue: null,
      newValue: input.type,
    });

    return toRecord(issue);
  }

  async resolve(id: number, input: ResolveIssueInput, userId: number): Promise<IssueRecord> {
    const issue = await this.prisma.issue.findUnique({ where: { id } });
    if (!issue) throw new NotFoundError('Issue not found');
    if (issue.status === 'RESOLVED') {
      throw new ValidationError('Issue is already resolved');
    }

    const now = new Date();
    const updated = await this.prisma.issue.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolverId: userId,
        resolvedAt: now,
        notes: input.notes !== undefined ? input.notes || null : issue.notes,
      },
      include: ISSUE_INCLUDES,
    });

    await this.audit.write({
      userId,
      objectType: 'Issue',
      objectId: id,
      field: 'status',
      oldValue: 'OPEN',
      newValue: 'RESOLVED',
    });

    return toRecord(updated);
  }
}
