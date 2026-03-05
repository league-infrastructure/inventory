/**
 * Round-trip integration test: import seed data through the service
 * layer, export it back, and verify field-by-field equality.
 */

process.env.NODE_ENV = 'test';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://app:devpassword@localhost:5433/app';
}

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { ServiceRegistry } from '../../server/src/services/service.registry';

const prisma = new PrismaClient();
const registry = ServiceRegistry.create(prisma);

// Ensure a test user exists for service calls that need userId
let testUserId: number;
beforeAll(async () => {
  const user = await prisma.user.findFirst();
  if (user) {
    testUserId = user.id;
  } else {
    const created = await prisma.user.create({
      data: {
        email: 'roundtrip-test@example.com',
        googleId: 'roundtrip-test-google-id',
        displayName: 'Round Trip Test',
        role: 'QUARTERMASTER',
      },
    });
    testUserId = created.id;
  }
});

interface SeedData {
  sites: { name: string; address: string; latitude: number; longitude: number; isHomeSite: boolean }[];
  hostNames: { name: string }[];
  computers: { serialNumber: string; model: string; notes: string | null; siteIndex: number; hostNameIndex: number }[];
  kits: {
    name: string;
    description: string;
    siteIndex: number;
    packs: {
      name: string;
      description: string;
      items: { name: string; type: string; expectedQuantity?: number }[];
    }[];
  }[];
}

const FIXTURE_PATH = path.resolve(__dirname, '../fixtures/inventory-seed.json');

describe('Round-trip test: import → export → compare', () => {
  const seed: SeedData = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
  const getUserId = () => testUserId;
  const suffix = Date.now();

  // Track created IDs for cleanup
  const createdSiteIds: number[] = [];
  const createdHostNameIds: number[] = [];
  const createdComputerIds: number[] = [];
  const createdKitIds: number[] = [];

  afterAll(async () => {
    // Clean up in reverse order to respect FK constraints
    for (const kitId of createdKitIds) {
      const kit = await prisma.kit.findUnique({
        where: { id: kitId },
        include: { packs: { include: { items: true } } },
      });
      if (kit) {
        for (const pack of kit.packs) {
          for (const item of pack.items) {
            await prisma.item.delete({ where: { id: item.id } }).catch(() => {});
          }
          await prisma.pack.delete({ where: { id: pack.id } }).catch(() => {});
        }
        await prisma.kit.delete({ where: { id: kitId } }).catch(() => {});
      }
    }
    for (const id of createdComputerIds) {
      // Unassign hostnames first
      await prisma.hostName.updateMany({ where: { computerId: id }, data: { computerId: null } });
      await prisma.computer.delete({ where: { id } }).catch(() => {});
    }
    for (const id of createdHostNameIds) {
      await prisma.hostName.delete({ where: { id } }).catch(() => {});
    }
    for (const id of createdSiteIds) {
      await prisma.site.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('imports seed data through the service layer', async () => {
    // 1. Create sites (add suffix to names for uniqueness)
    for (const s of seed.sites) {
      const site = await registry.sites.create({ ...s, name: `${s.name}-${suffix}` }, getUserId());
      createdSiteIds.push(site.id);
    }
    expect(createdSiteIds).toHaveLength(seed.sites.length);

    // 2. Create host names (add suffix for uniqueness)
    for (const h of seed.hostNames) {
      const hostname = await registry.hostNames.create({ name: `${h.name}-${suffix}` });
      createdHostNameIds.push(hostname.id);
    }
    expect(createdHostNameIds).toHaveLength(seed.hostNames.length);

    // 3. Create computers with site and hostname assignments
    for (const c of seed.computers) {
      const computer = await registry.computers.create({
        serialNumber: c.serialNumber,
        model: c.model,
        notes: c.notes,
        siteId: createdSiteIds[c.siteIndex],
        hostNameId: createdHostNameIds[c.hostNameIndex],
      }, getUserId());
      createdComputerIds.push(computer.id);
    }
    expect(createdComputerIds).toHaveLength(seed.computers.length);

    // 4. Create kits with packs and items
    for (const k of seed.kits) {
      const kit = await registry.kits.create({
        name: `${k.name}-${suffix}`,
        description: k.description,
        siteId: createdSiteIds[k.siteIndex],
      }, getUserId());
      createdKitIds.push(kit.id);

      for (const p of k.packs) {
        const pack = await registry.packs.create({
          name: p.name,
          description: p.description,
        }, getUserId(), kit.id);

        for (const item of p.items) {
          await registry.items.create({
            name: item.name,
            type: item.type,
            expectedQuantity: item.expectedQuantity ?? null,
          }, getUserId(), pack.id);
        }
      }
    }
    expect(createdKitIds).toHaveLength(seed.kits.length);
  });

  it('exports data and verifies field-by-field equality', async () => {
    // Export sites
    for (let i = 0; i < seed.sites.length; i++) {
      const exported = await registry.sites.get(createdSiteIds[i]);
      expect(exported.name).toBe(`${seed.sites[i].name}-${suffix}`);
      expect(exported.address).toBe(seed.sites[i].address);
      expect(exported.latitude).toBe(seed.sites[i].latitude);
      expect(exported.longitude).toBe(seed.sites[i].longitude);
      expect(exported.isHomeSite).toBe(seed.sites[i].isHomeSite);
      expect(exported.isActive).toBe(true);
    }

    // Export host names
    const allHostNames = await registry.hostNames.list();
    for (let i = 0; i < seed.hostNames.length; i++) {
      const match = allHostNames.find((h) => h.id === createdHostNameIds[i]);
      expect(match).toBeDefined();
      expect(match!.name).toBe(`${seed.hostNames[i].name}-${suffix}`);
    }

    // Export computers
    for (let i = 0; i < seed.computers.length; i++) {
      const exported = await registry.computers.get(createdComputerIds[i]);
      expect(exported.serialNumber).toBe(seed.computers[i].serialNumber);
      expect(exported.model).toBe(seed.computers[i].model);
      expect(exported.notes).toBe(seed.computers[i].notes);
      expect(exported.siteId).toBe(createdSiteIds[seed.computers[i].siteIndex]);
      expect(exported.hostName).toBeTruthy();
      expect(exported.hostName!.id).toBe(createdHostNameIds[seed.computers[i].hostNameIndex]);
    }

    // Export kits with packs and items
    for (let ki = 0; ki < seed.kits.length; ki++) {
      const exported = await registry.kits.get(createdKitIds[ki]);
      expect(exported.name).toBe(`${seed.kits[ki].name}-${suffix}`);
      expect(exported.description).toBe(seed.kits[ki].description);
      expect(exported.siteId).toBe(createdSiteIds[seed.kits[ki].siteIndex]);
      expect(exported.status).toBe('ACTIVE');
      expect(exported.qrCode).toBe(`/k/${createdKitIds[ki]}`);
      expect(exported.packs).toHaveLength(seed.kits[ki].packs.length);

      for (let pi = 0; pi < seed.kits[ki].packs.length; pi++) {
        const seedPack = seed.kits[ki].packs[pi];
        const exportedPack = exported.packs.find((p) => p.name === seedPack.name);
        expect(exportedPack).toBeDefined();
        expect(exportedPack!.description).toBe(seedPack.description);
        expect(exportedPack!.items).toHaveLength(seedPack.items.length);

        for (const seedItem of seedPack.items) {
          const exportedItem = exportedPack!.items.find((i) => i.name === seedItem.name);
          expect(exportedItem).toBeDefined();
          expect(exportedItem!.type).toBe(seedItem.type);
          if (seedItem.type === 'COUNTED') {
            expect(exportedItem!.expectedQuantity).toBe(seedItem.expectedQuantity);
          } else {
            expect(exportedItem!.expectedQuantity).toBeNull();
          }
        }
      }
    }
  });
});
