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
import { OsService } from './os.service';
import { ImageService } from './image.service';
import { CategoryService } from './category.service';
import { ManufacturerService } from './manufacturer.service';
import { NoteService } from './note.service';
import { FileStorage, SpacesFileStorage, DbFileStorage } from './file-storage';
import { GeneratedFileService } from './generated-file.service';

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
  readonly os: OsService;
  readonly images: ImageService;
  readonly categories: CategoryService;
  readonly manufacturers: ManufacturerService;
  readonly notes: NoteService;
  readonly fileStorage: FileStorage;
  readonly generatedFiles: GeneratedFileService;

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
    this.os = new OsService(prisma, this.audit);
    this.images = new ImageService(prisma);
    this.categories = new CategoryService(prisma, this.audit);
    this.manufacturers = new ManufacturerService(prisma, this.audit);
    this.notes = new NoteService(prisma);

    // Selected once here (composition root), by whether Spaces
    // credentials are configured — dev/test never needs real
    // DO_SPACES_KEY/DO_SPACES_SECRET to exercise generated-file code.
    //
    // The `NODE_ENV !== 'test'` check is a second, independent guard
    // against real Spaces uploads during tests (layer 1 is jest's
    // setupFiles stripping the credentials entirely — see
    // tests/server/jest.setup-env.js). This one holds even if a test
    // deliberately re-sets DO_SPACES_KEY/DO_SPACES_SECRET on
    // process.env, e.g. to prove the guard itself works.
    const useSpaces = process.env.NODE_ENV !== 'test'
      && !!process.env.DO_SPACES_KEY
      && !!process.env.DO_SPACES_SECRET;
    this.fileStorage = useSpaces
      ? new SpacesFileStorage()
      : new DbFileStorage(prisma);
    this.generatedFiles = new GeneratedFileService(prisma, this.fileStorage);
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
    await p.note.deleteMany();
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
    await p.image.deleteMany();
    await p.category.deleteMany();
  }
}
