/**
 * Inventory load-and-verify test.
 *
 * 1. Clears all business data from the database (keeps users).
 * 2. Loads the seed fixture through the service layer.
 * 3. Reads everything back and verifies field-by-field equality.
 *
 * When the test finishes the database contains a realistic example
 * inventory that mirrors the League of Amazing Programmers' real gear.
 */

process.env.NODE_ENV = 'test';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://app:devpassword@localhost:5433/app';
}

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { ServiceRegistry } from '../../server/src/services/service.registry';

// ── types matching the seed JSON ──────────────────────────────────

interface SeedSite {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  isHomeSite: boolean;
}

interface SeedHostName {
  name: string;
}

interface SeedComputer {
  serialNumber: string;
  serviceTag: string | null;
  model: string;
  notes: string | null;
  siteIndex: number;
  hostNameIndex: number;
  kitSlug: string;
}

interface SeedItem {
  name: string;
  type: string;
  expectedQuantity?: number;
}

interface SeedPack {
  name: string;
  description: string;
  items: SeedItem[];
}

interface SeedKit {
  slug: string;
  name: string;
  description: string;
  siteIndex: number;
  packs: SeedPack[];
}

interface SeedData {
  sites: SeedSite[];
  hostNames: SeedHostName[];
  computers: SeedComputer[];
  kits: SeedKit[];
}

// ── setup ─────────────────────────────────────────────────────────

const SEED_PATH = path.resolve(__dirname, '../data/inventory.seed.json');
const seed: SeedData = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));

const prisma = new PrismaClient();
const registry = ServiceRegistry.create(prisma);

let testUserId: number;

// Maps to track created IDs for cross-referencing
const siteIds: number[] = [];
const hostNameIds: number[] = [];
const kitIds: Map<string, number> = new Map();   // slug → id
const computerIds: number[] = [];

beforeAll(async () => {
  // Ensure a test user exists
  const user = await prisma.user.findFirst();
  if (user) {
    testUserId = user.id;
  } else {
    const created = await prisma.user.create({
      data: {
        email: 'inventory-test@league.org',
        googleId: 'inventory-test-google',
        displayName: 'Inventory Test',
        role: 'QUARTERMASTER',
      },
    });
    testUserId = created.id;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ── tests ─────────────────────────────────────────────────────────

describe('Inventory load-and-verify', () => {
  const uid = () => testUserId;

  it('clears all business data', async () => {
    await registry.clearAll();

    // Verify everything is empty
    expect(await prisma.site.count()).toBe(0);
    expect(await prisma.kit.count()).toBe(0);
    expect(await prisma.computer.count()).toBe(0);
    expect(await prisma.hostName.count()).toBe(0);
    expect(await prisma.pack.count()).toBe(0);
    expect(await prisma.item.count()).toBe(0);
    expect(await prisma.checkout.count()).toBe(0);

    // Users should still exist
    expect(await prisma.user.count()).toBeGreaterThan(0);
  });

  it('creates sites', async () => {
    for (const s of seed.sites) {
      const site = await registry.sites.create(s, uid());
      siteIds.push(site.id);
    }
    expect(siteIds).toHaveLength(seed.sites.length);
  });

  it('creates host names', async () => {
    for (const h of seed.hostNames) {
      const hn = await registry.hostNames.create(h);
      hostNameIds.push(hn.id);
    }
    expect(hostNameIds).toHaveLength(seed.hostNames.length);
  });

  it('creates kits with packs and items', async () => {
    for (const k of seed.kits) {
      const kit = await registry.kits.create({
        name: k.name,
        description: k.description,
        siteId: siteIds[k.siteIndex],
      }, uid());
      kitIds.set(k.slug, kit.id);

      for (const p of k.packs) {
        const pack = await registry.packs.create({
          name: p.name,
          description: p.description,
        }, uid(), kit.id);

        for (const item of p.items) {
          await registry.items.create({
            name: item.name,
            type: item.type,
            expectedQuantity: item.expectedQuantity ?? null,
          }, uid(), pack.id);
        }
      }
    }
    expect(kitIds.size).toBe(seed.kits.length);
  });

  it('creates computers with hostname and kit assignments', async () => {
    for (const c of seed.computers) {
      const comp = await registry.computers.create({
        serialNumber: c.serialNumber,
        serviceTag: c.serviceTag,
        model: c.model,
        notes: c.notes,
        siteId: siteIds[c.siteIndex],
        hostNameId: hostNameIds[c.hostNameIndex],
        kitId: kitIds.get(c.kitSlug),
      }, uid());
      computerIds.push(comp.id);
    }
    expect(computerIds).toHaveLength(seed.computers.length);
  });

  // ── verification ──────────────────────────────────────────────

  it('verifies sites', async () => {
    for (let i = 0; i < seed.sites.length; i++) {
      const site = await registry.sites.get(siteIds[i]);
      expect(site.name).toBe(seed.sites[i].name);
      expect(site.address).toBe(seed.sites[i].address);
      expect(site.latitude).toBe(seed.sites[i].latitude);
      expect(site.longitude).toBe(seed.sites[i].longitude);
      expect(site.isHomeSite).toBe(seed.sites[i].isHomeSite);
      expect(site.isActive).toBe(true);
    }
  });

  it('verifies host names', async () => {
    const all = await registry.hostNames.list();
    expect(all).toHaveLength(seed.hostNames.length);
    for (let i = 0; i < seed.hostNames.length; i++) {
      const hn = all.find(h => h.id === hostNameIds[i]);
      expect(hn).toBeDefined();
      expect(hn!.name).toBe(seed.hostNames[i].name);
    }
  });

  it('verifies computers with hostname and kit assignments', async () => {
    for (let i = 0; i < seed.computers.length; i++) {
      const comp = await registry.computers.get(computerIds[i]);
      const sc = seed.computers[i];

      expect(comp.serialNumber).toBe(sc.serialNumber);
      expect(comp.serviceTag).toBe(sc.serviceTag);
      expect(comp.model).toBe(sc.model);
      expect(comp.notes).toBe(sc.notes);
      expect(comp.siteId).toBe(siteIds[sc.siteIndex]);
      expect(comp.qrCode).toBe(`/c/${comp.id}`);

      // Hostname assignment
      expect(comp.hostName).toBeDefined();
      expect(comp.hostName!.name).toBe(seed.hostNames[sc.hostNameIndex].name);

      // Kit assignment
      const expectedKitId = kitIds.get(sc.kitSlug);
      expect(comp.kitId).toBe(expectedKitId);
    }
  });

  it('verifies kits with packs and items', async () => {
    for (const sk of seed.kits) {
      const kitId = kitIds.get(sk.slug)!;
      const kit = await registry.kits.get(kitId);

      expect(kit.name).toBe(sk.name);
      expect(kit.description).toBe(sk.description);
      expect(kit.siteId).toBe(siteIds[sk.siteIndex]);
      expect(kit.status).toBe('ACTIVE');
      expect(kit.qrCode).toBe(`/k/${kitId}`);
      expect(kit.packs).toHaveLength(sk.packs.length);

      for (const sp of sk.packs) {
        const pack = kit.packs.find(p => p.name === sp.name);
        expect(pack).toBeDefined();
        expect(pack!.description).toBe(sp.description);
        expect(pack!.items).toHaveLength(sp.items.length);

        for (const si of sp.items) {
          const item = pack!.items.find(it => it.name === si.name);
          expect(item).toBeDefined();
          expect(item!.type).toBe(si.type);
          if (si.type === 'COUNTED') {
            expect(item!.expectedQuantity).toBe(si.expectedQuantity);
          } else {
            expect(item!.expectedQuantity).toBeNull();
          }
        }
      }

      // Verify computers assigned to this kit
      const expectedComputers = seed.computers.filter(c => c.kitSlug === sk.slug);
      expect(kit.computers).toHaveLength(expectedComputers.length);
      for (const ec of expectedComputers) {
        const comp = kit.computers.find(c => c.serialNumber === ec.serialNumber);
        expect(comp).toBeDefined();
        expect(comp!.model).toBe(ec.model);
        expect(comp!.hostName).toBeDefined();
        expect(comp!.hostName!.name).toBe(seed.hostNames[ec.hostNameIndex].name);
      }
    }
  });

  it('verifies total counts match seed data', async () => {
    // Count only the records we created (other test files may add data
    // when running in the same Jest process).
    expect(siteIds).toHaveLength(seed.sites.length);
    expect(hostNameIds).toHaveLength(seed.hostNames.length);
    expect(computerIds).toHaveLength(seed.computers.length);
    expect(kitIds.size).toBe(seed.kits.length);

    // Verify packs and items via the kits we created
    let totalPacks = 0;
    let totalItems = 0;
    for (const sk of seed.kits) {
      const kit = await registry.kits.get(kitIds.get(sk.slug)!);
      totalPacks += kit.packs.length;
      for (const p of kit.packs) totalItems += p.items.length;
    }
    const expectedPacks = seed.kits.reduce((sum, k) => sum + k.packs.length, 0);
    expect(totalPacks).toBe(expectedPacks);

    const expectedItems = seed.kits.reduce(
      (sum, k) => sum + k.packs.reduce((ps, p) => ps + p.items.length, 0), 0);
    expect(totalItems).toBe(expectedItems);
  });
});
