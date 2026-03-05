/**
 * Shared test setup for service layer tests.
 * Provides a ServiceRegistry connected to the test database.
 */

process.env.NODE_ENV = 'test';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://app:devpassword@localhost:5433/app';
}

import { PrismaClient } from '@prisma/client';
import { ServiceRegistry } from '../../../server/src/services/service.registry';

const prisma = new PrismaClient();
let registry: ServiceRegistry;
let testUserId: number;
const suffix = Date.now();

export function getRegistry(): ServiceRegistry {
  return registry;
}

export function getUserId(): number {
  return testUserId;
}

export function getSuffix(): number {
  return suffix;
}

export function getPrisma(): PrismaClient {
  return prisma;
}

export async function setupTestUser(): Promise<void> {
  const user = await prisma.user.findFirst();
  if (user) {
    testUserId = user.id;
  } else {
    const created = await prisma.user.create({
      data: {
        email: `svc-test-${suffix}@example.com`,
        googleId: `svc-test-${suffix}`,
        displayName: 'Service Test User',
        role: 'QUARTERMASTER',
      },
    });
    testUserId = created.id;
  }
  registry = ServiceRegistry.create(prisma);
}

export async function teardown(): Promise<void> {
  await prisma.$disconnect();
}
