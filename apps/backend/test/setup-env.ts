import { config } from 'dotenv';
import { resolve } from 'path';

const runtimeEnvironment = process.env.NODE_ENV ?? 'development';

// Load the environment-specific file when present, then fall back to development defaults.
config({ path: resolve(__dirname, `../.env.${runtimeEnvironment}`) });
config({ path: resolve(__dirname, '../.env.development'), override: false });

// Unit tests should not require a live database connection.
process.env.SKIP_PRISMA_TX ??= 'true';
