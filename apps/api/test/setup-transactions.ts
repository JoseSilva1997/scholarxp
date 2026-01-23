if (process.env.SKIP_PRISMA_TX === 'true') {
  // Provide no-op hooks so unit tests stay fast and deterministic without a database.
  beforeEach(() => undefined);
  afterEach(() => undefined);
  afterAll(() => undefined);
} else {
  // Integration-style tests can opt in by unsetting SKIP_PRISMA_TX.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaClient } = require('@prisma/client');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaPg } = require('@prisma/adapter-pg');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool } = require('pg');

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set in setup-transactions');
  }

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('BEGIN');
  });

  afterEach(async () => {
    await prisma.$executeRawUnsafe('ROLLBACK');
  });

  (global as any).prismaTestClient = prisma;
}
