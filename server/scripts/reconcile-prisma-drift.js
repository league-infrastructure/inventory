#!/usr/bin/env node

const { Client } = require('pg');
const { execSync } = require('child_process');

const TARGET_MIGRATION = '20260525150701_add_manufacturer_entity';

function log(msg) {
  console.log(`[prisma-reconcile] ${msg}`);
}

async function relationExists(client, tableName) {
  const res = await client.query(
    `
      SELECT to_regclass($1) IS NOT NULL AS exists
    `,
    [`public."${tableName}"`],
  );
  return Boolean(res.rows[0]?.exists);
}

async function migrationsTableExists(client) {
  const res = await client.query(
    `
      SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS exists
    `,
  );
  return Boolean(res.rows[0]?.exists);
}

async function migrationNeedsResolve(client) {
  const res = await client.query(
    `
      SELECT finished_at
      FROM "_prisma_migrations"
      WHERE migration_name = $1
      ORDER BY started_at DESC
      LIMIT 1
    `,
    [TARGET_MIGRATION],
  );

  if (res.rows.length === 0) return true;
  return !res.rows[0].finished_at;
}

async function ensureManufacturerRelationPieces(client) {
  await client.query('ALTER TABLE "Computer" ADD COLUMN IF NOT EXISTS "manufacturerId" INTEGER');
  await client.query('CREATE INDEX IF NOT EXISTS "Computer_manufacturerId_idx" ON "Computer"("manufacturerId")');
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Computer_manufacturerId_fkey'
      ) THEN
        ALTER TABLE "Computer"
        ADD CONSTRAINT "Computer_manufacturerId_fkey"
        FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
      END IF;
    END
    $$;
  `);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log('DATABASE_URL not set; skipping drift reconciliation.');
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const manufacturerExists = await relationExists(client, 'Manufacturer');
    const computerExists = await relationExists(client, 'Computer');
    const prismaMigrationsExists = await migrationsTableExists(client);

    if (!manufacturerExists || !computerExists || !prismaMigrationsExists) {
      log('No relevant restore drift detected; continuing.');
      return;
    }

    await ensureManufacturerRelationPieces(client);
    log('Ensured Computer.manufacturerId column, index, and foreign key.');

    const needsResolve = await migrationNeedsResolve(client);
    if (!needsResolve) {
      log(`Migration ${TARGET_MIGRATION} is already marked applied.`);
      return;
    }

    log(`Marking migration ${TARGET_MIGRATION} as applied.`);
    execSync(`npx prisma migrate resolve --applied ${TARGET_MIGRATION} --schema prisma/schema.prisma`, {
      stdio: 'inherit',
    });
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[prisma-reconcile] Failed to reconcile migration drift.');
  if (err instanceof Error) {
    console.error(err.stack || err.message);
  } else {
    console.error(err);
  }
  process.exit(1);
});
