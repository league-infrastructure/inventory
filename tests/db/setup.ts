/**
 * Jest globalSetup for database tests.
 *
 * Creates the app_test database if it doesn't exist, then runs
 * Prisma migrations against it.
 */

import { Client } from 'pg';
import { execSync } from 'child_process';

const TEST_DB = 'app_test';
const BASE_URL = process.env.DATABASE_URL || 'postgresql://app:devpassword@localhost:5433/app';

export default async function setup() {
  // Connect to the default database to create the test database
  const client = new Client({ connectionString: BASE_URL });
  await client.connect();

  try {
    // Check if test database exists
    const result = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [TEST_DB],
    );

    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE ${TEST_DB}`);
      console.log(`Created test database: ${TEST_DB}`);
    }
  } finally {
    await client.end();
  }

  // Set DATABASE_URL for Prisma and run migrations
  const testUrl = BASE_URL.replace(/\/[^/]+$/, `/${TEST_DB}`);
  process.env.DATABASE_URL = testUrl;

  execSync('npx prisma migrate deploy', {
    cwd: require('path').resolve(__dirname, '../../server'),
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'pipe',
  });
}
