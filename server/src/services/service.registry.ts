import { PrismaClient, AuditSource } from '@prisma/client';
import { prisma as defaultPrisma } from './prisma';
import { AuditService } from './audit.service';
import { QrService } from './qr.service';
import { SiteService } from './site.service';
import { HostNameService } from './hostname.service';
import { ComputerService } from './computer.service';
import { KitService } from './kit.service';
import { PackService } from './pack.service';
import { ItemService } from './item.service';
import { TransferService } from './transfer.service';
import { TokenService } from './token.service';
import { InventoryCheckService } from './inventory-check.service';
import { IssueService } from './issue.service';
import { LabelService } from './label.service';
import { ExportService } from './export.service';
import { ImportService } from './import.service';
import { SearchService } from './search.service';
import { ReportService } from './report.service';

export class ServiceRegistry {
  readonly prisma: PrismaClient;
  readonly audit: AuditService;
  readonly qr: QrService;
  readonly sites: SiteService;
  readonly hostNames: HostNameService;
  readonly computers: ComputerService;
  readonly kits: KitService;
  readonly packs: PackService;
  readonly items: ItemService;
  readonly transfers: TransferService;
  readonly tokens: TokenService;
  readonly inventoryChecks: InventoryCheckService;
  readonly issues: IssueService;
  readonly labels: LabelService;
  readonly exports: ExportService;
  readonly imports: ImportService;
  readonly search: SearchService;
  readonly reports: ReportService;

  private constructor(prisma: PrismaClient, source: AuditSource = 'UI') {
    this.prisma = prisma;
    this.audit = new AuditService(prisma, source);
    this.qr = new QrService(prisma);
    this.sites = new SiteService(prisma, this.audit);
    this.hostNames = new HostNameService(prisma, this.audit);
    this.computers = new ComputerService(prisma, this.audit);
    this.kits = new KitService(prisma, this.audit);
    this.packs = new PackService(prisma, this.audit);
    this.items = new ItemService(prisma, this.audit);
    this.transfers = new TransferService(prisma, this.audit);
    this.tokens = new TokenService(prisma);
    this.inventoryChecks = new InventoryCheckService(prisma, this.audit);
    this.issues = new IssueService(prisma, this.audit);
    this.labels = new LabelService(prisma);
    this.exports = new ExportService(prisma);
    this.imports = new ImportService(prisma, this.audit);
    this.search = new SearchService(prisma);
    this.reports = new ReportService(prisma);
  }

  static create(prisma?: PrismaClient, source?: AuditSource): ServiceRegistry {
    return new ServiceRegistry(prisma ?? defaultPrisma, source);
  }

  /**
   * Delete all business data from the database in FK-safe order.
   * Preserves users and system tables (Counter, Config, Session).
   */
  async clearAll(): Promise<void> {
    const p = this.prisma;
    await p.inventoryCheckLine.deleteMany();
    await p.inventoryCheck.deleteMany();
    await p.issue.deleteMany();
    await p.transfer.deleteMany();
    await p.item.deleteMany();
    await p.pack.deleteMany();
    await p.hostName.updateMany({ data: { computerId: null } });
    await p.computer.deleteMany();
    await p.operatingSystem.deleteMany();
    await p.kit.deleteMany();
    await p.hostName.deleteMany();
    await p.site.deleteMany();
    await p.auditLog.deleteMany();
    await p.apiToken.deleteMany();
    await p.quartermasterPattern.deleteMany();
  }
}
