// Configures Jest lifecycle hooks to provide transaction-based isolation for e2e tests when DATABASE_URL is available.
// Unit tests (SKIP_PRISMA_TX='true') skip this setup; e2e tests roll back changes after each test.
// Uses PrismaClient with native PostgreSQL transactions: BEGIN before test, ROLLBACK after.
// This pattern enables fast, deterministic e2e tests without requiring expensive full-database teardown.

if (process.env.SKIP_PRISMA_TX === 'true') {
  // Unit tests stay fast and deterministic by using mocks; no database connection is needed.
  beforeEach(() => undefined);
  afterEach(() => undefined);
  afterAll(() => undefined);
} else {
  // Integration-style e2e tests opt in to live database by unsetting SKIP_PRISMA_TX (via NODE_ENV=test).

  const { PrismaClient } = require('@prisma/client');

  const { PrismaPg } = require('@prisma/adapter-pg');

  const { Pool } = require('pg');

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set in setup-transactions');
  }

  // Create a connection pool and Prisma client with raw adapter for direct SQL access via $executeRawUnsafe.
  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  // Tear down all connections after all tests complete to prevent dangling handles.
  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  // Start a transaction before each test: changes are isolated from other tests and the database state.
  beforeEach(async () => {
    await prisma.$executeRawUnsafe('BEGIN');
  });

  // Automatically roll back all changes after each test, returning the database to its pre-test state.
  // This avoids cascading pollution and allows tests to run in any order without setup/teardown dependencies.
  afterEach(async () => {
    await prisma.$executeRawUnsafe('ROLLBACK');
  });

  // Export the client so e2e suites can seed state inside the transaction scope.
  (global as any).prismaTestClient = prisma;
}
