/**
 * Truncates all application tables between test runs.
 * Uses CASCADE to handle foreign key constraints.
 * Does not truncate the Session table (managed by connect-pg-simple).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TABLES = [
  'AuditLog',
  'InventoryCheckLine',
  'InventoryCheck',
  'Issue',
  'Checkout',
  'Item',
  'Computer',
  'HostName',
  'Pack',
  'Kit',
  'Site',
  'User',
  'QuartermasterPattern',
  'Counter',
  'Config',
];

export async function truncateAll() {
  await prisma.$executeRawUnsafe(
    TABLES.map((t) => `TRUNCATE TABLE "${t}" CASCADE`).join('; '),
  );
}

export { prisma };
