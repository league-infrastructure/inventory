/**
 * Test data factory functions.
 *
 * Each factory creates a record with sensible defaults. Override any
 * field by passing an object. Unique fields use timestamps to avoid
 * constraint violations.
 */

import { PrismaClient, UserRole, KitStatus, ItemType, ComputerDisposition } from '@prisma/client';

const prisma = new PrismaClient();

let counter = 0;
function uid() {
  return `${Date.now()}-${++counter}`;
}

export async function createTestUser(overrides: Record<string, any> = {}) {
  const u = uid();
  return prisma.user.create({
    data: {
      googleId: `google-${u}`,
      email: `user-${u}@jointheleague.org`,
      displayName: 'Test User',
      role: 'INSTRUCTOR' as UserRole,
      ...overrides,
    },
  });
}

export async function createTestSite(overrides: Record<string, any> = {}) {
  return prisma.site.create({
    data: {
      name: `Site ${uid()}`,
      ...overrides,
    },
  });
}

export async function createTestKit(siteId: number, overrides: Record<string, any> = {}) {
  return prisma.kit.create({
    data: {
      name: `Kit ${uid()}`,
      siteId,
      status: 'ACTIVE' as KitStatus,
      ...overrides,
    },
  });
}

export async function createTestPack(kitId: number, overrides: Record<string, any> = {}) {
  return prisma.pack.create({
    data: {
      name: `Pack ${uid()}`,
      kitId,
      ...overrides,
    },
  });
}

export async function createTestItem(packId: number, overrides: Record<string, any> = {}) {
  return prisma.item.create({
    data: {
      name: `Item ${uid()}`,
      type: 'COUNTED' as ItemType,
      expectedQuantity: 1,
      packId,
      ...overrides,
    },
  });
}

export async function createTestComputer(overrides: Record<string, any> = {}) {
  return prisma.computer.create({
    data: {
      disposition: 'ACTIVE' as ComputerDisposition,
      ...overrides,
    },
  });
}

export async function createTestHostName(overrides: Record<string, any> = {}) {
  return prisma.hostName.create({
    data: {
      name: `Host-${uid()}`,
      ...overrides,
    },
  });
}

export { prisma };
