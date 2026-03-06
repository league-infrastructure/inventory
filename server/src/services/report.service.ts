import { PrismaClient } from '@prisma/client';

export interface AuditLogQuery {
  objectType?: string;
  objectId?: number;
  userId?: number;
  field?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogRecord {
  id: number;
  userId: number | null;
  userName: string | null;
  objectType: string;
  objectId: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  source: string;
  createdAt: string;
}

export interface AuditLogPage {
  records: AuditLogRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InventoryAgeRow {
  type: 'kit' | 'computer';
  id: number;
  name: string;
  lastInventoried: string | null;
  daysSinceInventory: number | null;
}

export class ReportService {
  constructor(private prisma: PrismaClient) {}

  async queryAuditLog(query: AuditLogQuery): Promise<AuditLogPage> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 200);
    const where: any = {};

    if (query.objectType) where.objectType = query.objectType;
    if (query.objectId) where.objectId = query.objectId;
    if (query.userId) where.userId = query.userId;
    if (query.field) where.field = { contains: query.field, mode: 'insensitive' };
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [records, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { displayName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      records: records.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: r.user?.displayName ?? null,
        objectType: r.objectType,
        objectId: r.objectId,
        field: r.field,
        oldValue: r.oldValue,
        newValue: r.newValue,
        source: r.source,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async getUserActivity(userId: number, limit = 50): Promise<AuditLogRecord[]> {
    const records = await this.prisma.auditLog.findMany({
      where: { userId },
      include: { user: { select: { displayName: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.user?.displayName ?? null,
      objectType: r.objectType,
      objectId: r.objectId,
      field: r.field,
      oldValue: r.oldValue,
      newValue: r.newValue,
      source: r.source,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getInventoryAge(): Promise<InventoryAgeRow[]> {
    const now = new Date();
    const rows: InventoryAgeRow[] = [];

    // Kits: last inventory check date
    const kits = await this.prisma.kit.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        number: true,
        name: true,
        inventoryChecks: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: { number: 'asc' },
    });

    for (const kit of kits) {
      const lastCheck = kit.inventoryChecks[0]?.createdAt ?? null;
      rows.push({
        type: 'kit',
        id: kit.id,
        name: `Kit #${kit.number}: ${kit.name}`,
        lastInventoried: lastCheck?.toISOString() ?? null,
        daysSinceInventory: lastCheck
          ? Math.floor((now.getTime() - lastCheck.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      });
    }

    // Computers: lastInventoried field
    const computers = await this.prisma.computer.findMany({
      where: { disposition: 'ACTIVE' },
      select: {
        id: true,
        model: true,
        lastInventoried: true,
        hostName: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
    });

    for (const c of computers) {
      rows.push({
        type: 'computer',
        id: c.id,
        name: c.hostName?.name || c.model || `Computer #${c.id}`,
        lastInventoried: c.lastInventoried?.toISOString() ?? null,
        daysSinceInventory: c.lastInventoried
          ? Math.floor((now.getTime() - c.lastInventoried.getTime()) / (1000 * 60 * 60 * 24))
          : null,
      });
    }

    // Sort: never-inventoried first, then by most days since inventory
    rows.sort((a, b) => {
      if (a.daysSinceInventory === null && b.daysSinceInventory === null) return 0;
      if (a.daysSinceInventory === null) return -1;
      if (b.daysSinceInventory === null) return -1;
      return b.daysSinceInventory - a.daysSinceInventory;
    });

    return rows;
  }

  async getCheckedOutByPerson(): Promise<Record<string, any[]>> {
    const checkouts = await this.prisma.checkout.findMany({
      where: { checkedInAt: null },
      include: {
        kit: { select: { id: true, number: true, name: true } },
        user: { select: { id: true, displayName: true } },
      },
      orderBy: { checkedOutAt: 'desc' },
    });

    const byPerson: Record<string, any[]> = {};
    for (const co of checkouts) {
      const name = co.user.displayName;
      if (!byPerson[name]) byPerson[name] = [];
      byPerson[name].push({
        checkoutId: co.id,
        kitId: co.kit.id,
        kitNumber: co.kit.number,
        kitName: co.kit.name,
        checkedOutAt: co.checkedOutAt.toISOString(),
      });
    }

    return byPerson;
  }
}
