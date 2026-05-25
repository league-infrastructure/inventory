// server/prisma/seed-manufacturer-backfill.ts
//
// One-time backfill script: seeds Manufacturer rows from existing Computer.manufacturer
// string values and wires up manufacturerId FKs.
//
// Run manually (not wired into prisma seed):
//   cd server && npx ts-node prisma/seed-manufacturer-backfill.ts
//
// Safe to run multiple times — idempotent via upsert + null-id guard.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function toTitleCase(s: string): string {
  return s.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

async function main() {
  const rows = await prisma.$queryRaw<{ manufacturer: string }[]>`
    SELECT DISTINCT TRIM(manufacturer) AS manufacturer
    FROM "Computer"
    WHERE manufacturer IS NOT NULL AND TRIM(manufacturer) != ''
  `;

  console.log(`Found ${rows.length} distinct non-empty manufacturer value(s).`);

  for (const { manufacturer } of rows) {
    const name = toTitleCase(manufacturer);
    const mfg = await prisma.manufacturer.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    // Use a raw UPDATE so we can match on TRIM(manufacturer) ILIKE and also
    // handle values that were stored with surrounding whitespace.
    const result = await prisma.$executeRaw`
      UPDATE "Computer"
      SET "manufacturerId" = ${mfg.id}
      WHERE TRIM(manufacturer) ILIKE ${manufacturer}
        AND "manufacturerId" IS NULL
    `;
    console.log(`  "${name}" (id=${mfg.id}): linked ${result} computer(s).`);
  }

  console.log(`Backfill complete — processed ${rows.length} distinct manufacturer values.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
