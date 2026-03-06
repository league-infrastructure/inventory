---
status: draft
from-architecture-version: null
to-architecture-version: null
---

# Sprint 009 Technical Plan

## Architecture Overview

This sprint restructures the service layer from standalone functions
into a class hierarchy with dependency injection. The three-layer
architecture (Routes → Services → Contracts) remains the same; only
the internal organization of the service layer changes.

```
Routes (HTTP adapters — factory functions receiving ServiceRegistry)
  → Service classes (extend BaseService, receive deps via constructor)
    → Contracts (unchanged TypeScript interfaces)
```

## Component Design

### Component: AuditService Class

**Use Cases**: SUC-003

**File**: `server/src/services/AuditService.ts`

Wraps the existing `auditLog.ts` functions into a class. This is
extracted first because all other services depend on it.

```typescript
class AuditService {
  constructor(private prisma: PrismaClient) {}

  async write(entries: AuditEntry | AuditEntry[]): Promise<void>
  diff(userId: number | null, objectType: string, objectId: number,
       oldObj: Record<string, any>, newObj: Record<string, any>,
       fields: string[], source?: AuditSource): AuditEntry[]
}
```

The existing `writeAuditLog` and `diffForAudit` functions move into
class methods. The `prisma` dependency is injected rather than imported.

### Component: QrService Class

**Use Cases**: SUC-003

**File**: `server/src/services/QrService.ts`

Merges the existing `qrCode.ts` (generation) and `qrService.ts`
(entity lookup) into a single class.

```typescript
class QrService {
  constructor(private prisma: PrismaClient, private baseUrl?: string) {}

  async generateDataUrl(path: string): Promise<string>
  async getKitQrInfo(id: number): Promise<QrInfo>
  async getComputerQrInfo(id: number): Promise<QrInfo>
  async getPackQrInfo(id: number): Promise<QrInfo>
}
```

### Component: BaseService Abstract Class

**Use Cases**: SUC-001

**File**: `server/src/services/BaseService.ts`

Generic abstract class parameterized by record, create-input, and
update-input contract types.

```typescript
abstract class BaseService<TRecord, TCreate, TUpdate> {
  protected prisma: PrismaClient;
  protected audit: AuditService;
  protected abstract entityName: string;
  protected abstract auditFields: string[];

  constructor(prisma: PrismaClient, audit: AuditService) {
    this.prisma = prisma;
    this.audit = audit;
  }

  abstract list(filters?: unknown): Promise<TRecord[]>;
  abstract get(id: number): Promise<TRecord>;
  abstract create(input: TCreate, userId: number): Promise<TRecord>;
  abstract update(id: number, input: TUpdate, userId: number): Promise<TRecord>;

  protected buildAuditEntries(
    userId: number, id: number,
    oldObj: Record<string, any>,
    newObj: Record<string, any>
  ): AuditEntry[] {
    return this.audit.diff(userId, this.entityName, id, oldObj, newObj, this.auditFields);
  }

  protected async writeAudit(entries: AuditEntry | AuditEntry[]): Promise<void> {
    await this.audit.write(entries);
  }
}
```

Design decisions:
- `list`, `get`, `create`, `update` are abstract — every subclass
  must implement them. There is no default implementation because
  each entity has different Prisma includes, where clauses, and
  ordering.
- `delete` is not abstract because not all entities support deletion.
  Subclasses that need it implement it directly.
- `buildAuditEntries` and `writeAudit` are protected helpers that
  delegate to the injected AuditService, saving subclasses from
  repeating the pattern.
- `entityName` and `auditFields` are abstract properties that
  subclasses define — they drive audit log creation.

### Component: Domain Service Classes

**Use Cases**: SUC-002

**Files** (one per entity):

| Class | File | Extends | Extra Dependencies |
|-------|------|---------|-------------------|
| SiteService | `services/SiteService.ts` | BaseService | — |
| HostNameService | `services/HostNameService.ts` | BaseService | — |
| ComputerService | `services/ComputerService.ts` | BaseService | QrService |
| KitService | `services/KitService.ts` | BaseService | QrService |
| PackService | `services/PackService.ts` | BaseService | QrService |
| ItemService | `services/ItemService.ts` | BaseService | — |
| CheckoutService | `services/CheckoutService.ts` | BaseService | — |

Each class:
1. Extends `BaseService<XRecord, CreateXInput, UpdateXInput>`
2. Defines `entityName` and `auditFields` as class properties
3. Moves the current standalone functions into methods
4. Receives extra dependencies (QrService) via constructor
5. Keeps entity-specific methods (e.g., `SiteService.deactivate`,
   `KitService.clone`, `ComputerService.changeDisposition`)

Method bodies are largely unchanged from the current functions — the
logic moves into class methods and replaces module-level `prisma`
import with `this.prisma`.

**Naming convention**: Files change from `siteService.ts` (camelCase)
to `SiteService.ts` (PascalCase) to match the class name, following
TypeScript convention for files that export a class.

### Component: ServiceRegistry

**Use Cases**: SUC-003

**File**: `server/src/services/ServiceRegistry.ts`

Composition root that constructs all services with correct dependency
wiring.

```typescript
class ServiceRegistry {
  readonly sites: SiteService;
  readonly hostNames: HostNameService;
  readonly computers: ComputerService;
  readonly kits: KitService;
  readonly packs: PackService;
  readonly items: ItemService;
  readonly checkouts: CheckoutService;
  readonly qr: QrService;
  readonly audit: AuditService;

  private constructor(prisma: PrismaClient) {
    this.audit = new AuditService(prisma);
    this.qr = new QrService(prisma);
    this.sites = new SiteService(prisma, this.audit);
    this.hostNames = new HostNameService(prisma, this.audit);
    this.computers = new ComputerService(prisma, this.audit, this.qr);
    this.kits = new KitService(prisma, this.audit, this.qr);
    this.packs = new PackService(prisma, this.audit, this.qr);
    this.items = new ItemService(prisma, this.audit);
    this.checkouts = new CheckoutService(prisma, this.audit);
  }

  static create(prisma?: PrismaClient): ServiceRegistry {
    return new ServiceRegistry(prisma ?? defaultPrisma);
  }
}
```

Construction order matters: AuditService and QrService first (no
dependencies on other services), then domain services that depend on
them.

### Component: Route Factory Functions

**Use Cases**: SUC-003

**Files**: All files in `server/src/routes/`

Each business route file changes from a module that imports service
singletons to a factory function that receives ServiceRegistry:

```typescript
// Before
import * as siteService from '../services/siteService';
export const sitesRouter = Router();
sitesRouter.get('/sites', ...);

// After
import { ServiceRegistry } from '../services/ServiceRegistry';
export function sitesRouter(services: ServiceRegistry): Router {
  const router = Router();
  router.get('/sites', requireAuth, async (req, res, next) => {
    try { res.json(await services.sites.list()); }
    catch (err) { next(err); }
  });
  return router;
}
```

`server/src/index.ts` creates the registry and passes it to each
route factory:

```typescript
const services = ServiceRegistry.create();
app.use('/api', sitesRouter(services));
app.use('/api', computersRouter(services));
// ...
```

Auth, admin, and test auth routes are NOT migrated (same as Sprint 008).

### Component: Cleanup

**Use Cases**: SUC-002, SUC-004

After migration, delete the old files:
- `services/siteService.ts` → replaced by `services/SiteService.ts`
- `services/hostNameService.ts` → replaced by `services/HostNameService.ts`
- `services/computerService.ts` → replaced by `services/ComputerService.ts`
- `services/kitService.ts` → replaced by `services/KitService.ts`
- `services/packService.ts` → replaced by `services/PackService.ts`
- `services/itemService.ts` → replaced by `services/ItemService.ts`
- `services/checkoutService.ts` → replaced by `services/CheckoutService.ts`
- `services/qrService.ts` → merged into `services/QrService.ts`
- `services/qrCode.ts` → merged into `services/QrService.ts`
- `services/auditLog.ts` → replaced by `services/AuditService.ts`

Keep unchanged:
- `services/prisma.ts` — PrismaClient singleton (used by ServiceRegistry)
- `services/errors.ts` — ServiceError hierarchy (unchanged)
- `services/config.ts` — app configuration (unchanged)
- `services/logBuffer.ts` — log buffering (unchanged)

## Testing

- All existing API tests in `tests/server/` must pass without changes
- Round-trip test in `tests/server/round-trip.test.ts` must pass
  without changes (it imports service functions directly — the import
  paths will need updating to use the new class-based modules or the
  ServiceRegistry)
- TypeScript compilation must succeed
- Verify via grep: no `export async function` in service class files

## Open Questions

None.
