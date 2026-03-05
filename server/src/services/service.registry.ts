import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from './prisma';
import { AuditService } from './audit.service';
import { QrService } from './qr.service';
import { SiteService } from './site.service';
import { HostNameService } from './hostname.service';
import { ComputerService } from './computer.service';
import { KitService } from './kit.service';
import { PackService } from './pack.service';
import { ItemService } from './item.service';
import { CheckoutService } from './checkout.service';

export class ServiceRegistry {
  readonly audit: AuditService;
  readonly qr: QrService;
  readonly sites: SiteService;
  readonly hostNames: HostNameService;
  readonly computers: ComputerService;
  readonly kits: KitService;
  readonly packs: PackService;
  readonly items: ItemService;
  readonly checkouts: CheckoutService;

  private constructor(prisma: PrismaClient) {
    this.audit = new AuditService(prisma);
    this.qr = new QrService(prisma);
    this.sites = new SiteService(prisma, this.audit);
    this.hostNames = new HostNameService(prisma, this.audit);
    this.computers = new ComputerService(prisma, this.audit);
    this.kits = new KitService(prisma, this.audit);
    this.packs = new PackService(prisma, this.audit);
    this.items = new ItemService(prisma, this.audit);
    this.checkouts = new CheckoutService(prisma, this.audit);
  }

  static create(prisma?: PrismaClient): ServiceRegistry {
    return new ServiceRegistry(prisma ?? defaultPrisma);
  }
}
