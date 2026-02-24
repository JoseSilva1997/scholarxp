import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private pool: Pool;

  /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set');
    }

    // Prisma's adapter constructors are typed with `unknown`, so we cast to the concrete types to satisfy eslint's safety checks.
    const pool: Pool = new Pool({ connectionString: url });
    const adapter: PrismaPg = new PrismaPg(pool);
    super({ adapter });

    this.pool = pool;
  }
  /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

  async onModuleInit() {
    await this.$connect();
  }

  /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
  /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
}
