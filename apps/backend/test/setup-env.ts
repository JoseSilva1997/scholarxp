import { config } from 'dotenv';
import { resolve } from 'path';

// Load test-specific environment before any tests run.
config({ path: resolve(__dirname, '../.env.test') });

// Unit tests should not require a live database connection.
process.env.SKIP_PRISMA_TX ??= 'true';
