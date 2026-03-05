/**
 * Jest globalTeardown for database tests.
 *
 * Disconnects the Prisma client. The test database is left intact
 * for faster subsequent runs (migrations are idempotent).
 */

import { PrismaClient } from '@prisma/client';

export default async function teardown() {
  const prisma = new PrismaClient();
  await prisma.$disconnect();
}
