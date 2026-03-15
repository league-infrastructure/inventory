import { PrismaClient, ComputerDisposition } from '@prisma/client';
import { AuditService } from './audit.service';
import { BaseService } from './base.service';
import { NotFoundError, ValidationError } from './errors';
import { ComputerRecord, CreateComputerInput, UpdateComputerInput } from '../contracts';

interface ListComputersFilters {
  disposition?: string;
  siteId?: number;
  kitId?: number;
  unassigned?: boolean;
}

const COMPUTER_INCLUDES = {
  hostName: true,
  site: { select: { id: true, name: true } },
  kit: { select: { id: true, name: true } },
  os: { select: { id: true, name: true } },
  custodian: { select: { id: true, displayName: true } },
  category: { select: { id: true, name: true } },
};

export class ComputerService extends BaseService<ComputerRecord, CreateComputerInput, UpdateComputerInput> {
  protected readonly entityName = 'Computer';
  protected readonly auditFields = [
    'serialNumber', 'serviceTag', 'model', 'adminUsername', 'adminPassword', 'studentUsername', 'studentPassword',
    'disposition', 'dateReceived', 'lastInventoried', 'notes', 'siteId', 'kitId', 'osId', 'qrCode',
  ];

  constructor(prisma: PrismaClient, audit: AuditService) {
    super(prisma, audit);
  }

  async list(filters: ListComputersFilters = {}): Promise<ComputerRecord[]> {
    const where: any = {};

    if (filters.disposition && Object.values(ComputerDisposition).includes(filters.disposition as ComputerDisposition)) {
      where.disposition = filters.disposition;
    }
    if (filters.siteId != null) where.siteId = filters.siteId;
    if (filters.kitId != null) where.kitId = filters.kitId;
    if (filters.unassigned) {
      where.siteId = null;
      where.kitId = null;
    }

    const computers = await this.prisma.computer.findMany({
      where,
      include: COMPUTER_INCLUDES,
      orderBy: { id: 'asc' },
    });
    return computers as unknown as ComputerRecord[];
  }

  async get(id: number): Promise<ComputerRecord> {
    const computer = await this.prisma.computer.findUnique({
      where: { id },
      include: COMPUTER_INCLUDES,
    });
    if (!computer) throw new NotFoundError('Computer not found');
    return computer as unknown as ComputerRecord;
  }

  async create(input: CreateComputerInput, userId: number): Promise<ComputerRecord> {
    if (!input.serialNumber && !input.serviceTag && !input.model) {
      throw new ValidationError('At least one identifying field (serialNumber, serviceTag, or model) is required');
    }

    if (input.disposition && !Object.values(ComputerDisposition).includes(input.disposition as ComputerDisposition)) {
      throw new ValidationError('Invalid disposition value');
    }

    if (input.siteId != null) {
      if (typeof input.siteId !== 'number') throw new ValidationError('siteId must be a number');
      const site = await this.prisma.site.findUnique({ where: { id: input.siteId } });
      if (!site) throw new ValidationError('Site not found');
    }

    let kitSiteId: number | null = null;
    let kitCustodianId: number | null = null;
    if (input.kitId != null) {
      if (typeof input.kitId !== 'number') throw new ValidationError('kitId must be a number');
      const kit = await this.prisma.kit.findUnique({ where: { id: input.kitId } });
      if (!kit) throw new ValidationError('Kit not found');
      kitSiteId = kit.siteId;
      kitCustodianId = kit.custodianId;
    }

    if (input.osId != null) {
      if (typeof input.osId !== 'number') throw new ValidationError('osId must be a number');
      const os = await this.prisma.operatingSystem.findUnique({ where: { id: input.osId } });
      if (!os) throw new ValidationError('Operating system not found');
    }

    // When assigned to a kit, inherit the kit's siteId and custodianId
    const effectiveSiteId = input.kitId != null ? kitSiteId : (input.siteId || null);
    const effectiveCustodianId = input.kitId != null ? kitCustodianId : (input.custodianId || null);

    const computer = await this.prisma.computer.create({
      data: {
        serialNumber: input.serialNumber || null,
        serviceTag: input.serviceTag || null,
        model: input.model || null,
        modelNumber: input.modelNumber || null,
        manufacturedYear: input.manufacturedYear || null,
        adminUsername: input.adminUsername || null,
        adminPassword: input.adminPassword || null,
        studentUsername: input.studentUsername ?? 'student',
        studentPassword: input.studentPassword ?? 'student',
        ...(input.disposition && { disposition: input.disposition as ComputerDisposition }),
        dateReceived: input.dateReceived ? new Date(input.dateReceived) : null,
        lastInventoried: input.lastInventoried ? new Date(input.lastInventoried) : null,
        notes: input.notes || null,
        siteId: effectiveSiteId,
        kitId: input.kitId || null,
        custodianId: effectiveCustodianId,
        osId: input.osId || null,
        categoryId: input.categoryId || null,
      },
    });

    const qrPath = `/c/${computer.id}`;
    const updated = await this.prisma.computer.update({
      where: { id: computer.id },
      data: { qrCode: qrPath },
      include: COMPUTER_INCLUDES,
    });

    if (input.hostNameId != null && typeof input.hostNameId === 'number') {
      const hostName = await this.prisma.hostName.findUnique({ where: { id: input.hostNameId } });
      if (hostName) {
        await this.prisma.hostName.update({
          where: { id: input.hostNameId },
          data: { computerId: computer.id },
        });
      }
    }

    // Auto-match image by serial number: if an image fileName contains the serial, link it
    if (input.serialNumber) {
      const matchingImage = await this.prisma.image.findFirst({
        where: { fileName: { contains: input.serialNumber, mode: 'insensitive' } },
        select: { id: true },
      });
      if (matchingImage) {
        await this.prisma.computer.update({
          where: { id: computer.id },
          data: { imageId: matchingImage.id },
        });
      }
    }

    await this.auditCreate(userId, computer.id, updated);

    const result = await this.prisma.computer.findUnique({
      where: { id: computer.id },
      include: COMPUTER_INCLUDES,
    });
    return result as unknown as ComputerRecord;
  }

  async update(id: number, input: UpdateComputerInput, userId: number): Promise<ComputerRecord> {
    const existing = await this.prisma.computer.findUnique({
      where: { id },
      include: { hostName: true },
    });
    if (!existing) throw new NotFoundError('Computer not found');

    if (input.disposition && !Object.values(ComputerDisposition).includes(input.disposition as ComputerDisposition)) {
      throw new ValidationError('Invalid disposition value');
    }

    if (input.siteId != null) {
      if (typeof input.siteId !== 'number') throw new ValidationError('siteId must be a number');
      const site = await this.prisma.site.findUnique({ where: { id: input.siteId } });
      if (!site) throw new ValidationError('Site not found');
    }

    let assignedKit: { siteId: number | null; custodianId: number | null } | null = null;
    if (input.kitId != null) {
      if (typeof input.kitId !== 'number') throw new ValidationError('kitId must be a number');
      const kit = await this.prisma.kit.findUnique({ where: { id: input.kitId } });
      if (!kit) throw new ValidationError('Kit not found');
      assignedKit = { siteId: kit.siteId, custodianId: kit.custodianId };
    }

    if (input.osId != null) {
      if (typeof input.osId !== 'number') throw new ValidationError('osId must be a number');
      const os = await this.prisma.operatingSystem.findUnique({ where: { id: input.osId } });
      if (!os) throw new ValidationError('Operating system not found');
    }

    const data: any = {};
    if (input.serialNumber !== undefined) data.serialNumber = input.serialNumber || null;
    if (input.serviceTag !== undefined) data.serviceTag = input.serviceTag || null;
    if (input.model !== undefined) data.model = input.model || null;
    if (input.modelNumber !== undefined) data.modelNumber = input.modelNumber || null;
    if (input.manufacturedYear !== undefined) data.manufacturedYear = input.manufacturedYear || null;
    if (input.adminUsername !== undefined) data.adminUsername = input.adminUsername || null;
    if (input.adminPassword !== undefined) data.adminPassword = input.adminPassword || null;
    if (input.studentUsername !== undefined) data.studentUsername = input.studentUsername || null;
    if (input.studentPassword !== undefined) data.studentPassword = input.studentPassword || null;
    if (input.disposition !== undefined) data.disposition = input.disposition as ComputerDisposition;
    if (input.dateReceived !== undefined) data.dateReceived = input.dateReceived ? new Date(input.dateReceived) : null;
    if (input.lastInventoried !== undefined) data.lastInventoried = input.lastInventoried ? new Date(input.lastInventoried) : null;
    if (input.notes !== undefined) data.notes = input.notes || null;
    if (input.kitId !== undefined) data.kitId = input.kitId;
    if (input.osId !== undefined) data.osId = input.osId;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;

    // When assigning to a kit, sync siteId and custodianId from the kit
    if (assignedKit) {
      data.siteId = assignedKit.siteId;
      data.custodianId = assignedKit.custodianId;
    } else if (input.kitId === null) {
      // Removing from kit — allow explicit siteId/custodianId if provided
      if (input.siteId !== undefined) data.siteId = input.siteId;
      if (input.custodianId !== undefined) data.custodianId = input.custodianId;
    } else {
      // kitId not being changed — allow normal siteId/custodianId updates
      if (input.siteId !== undefined) data.siteId = input.siteId;
      if (input.custodianId !== undefined) data.custodianId = input.custodianId;
    }

    const updated = await this.prisma.computer.update({
      where: { id },
      data,
      include: COMPUTER_INCLUDES,
    });

    const auditEntries = this.buildAuditEntries(userId, id, existing, updated);

    if (input.hostNameId !== undefined) {
      const oldHostNameId = existing.hostName?.id ?? null;

      if (input.hostNameId === null) {
        if (existing.hostName) {
          await this.prisma.hostName.update({
            where: { id: existing.hostName.id },
            data: { computerId: null },
          });
        }
      } else if (typeof input.hostNameId === 'number') {
        if (existing.hostName && existing.hostName.id !== input.hostNameId) {
          await this.prisma.hostName.update({
            where: { id: existing.hostName.id },
            data: { computerId: null },
          });
        }
        await this.prisma.hostName.update({
          where: { id: input.hostNameId },
          data: { computerId: id },
        });
      }

      if (oldHostNameId !== input.hostNameId) {
        auditEntries.push(this.createAuditEntry(
          userId, id, 'hostName',
          oldHostNameId != null ? String(oldHostNameId) : null,
          input.hostNameId != null ? String(input.hostNameId) : null,
        ));
      }
    }

    if (auditEntries.length > 0) {
      await this.writeAudit(auditEntries);
    }

    const result = await this.prisma.computer.findUnique({
      where: { id },
      include: COMPUTER_INCLUDES,
    });
    return result as unknown as ComputerRecord;
  }

  async changeDisposition(id: number, disposition: string, userId: number): Promise<ComputerRecord> {
    const existing = await this.prisma.computer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Computer not found');

    if (!disposition || !Object.values(ComputerDisposition).includes(disposition as ComputerDisposition)) {
      throw new ValidationError('Invalid disposition value');
    }

    const updated = await this.prisma.computer.update({
      where: { id },
      data: { disposition: disposition as ComputerDisposition },
      include: COMPUTER_INCLUDES,
    });

    await this.writeAudit(this.createAuditEntry(userId, id, 'disposition', existing.disposition, disposition));
    return updated as unknown as ComputerRecord;
  }
}
