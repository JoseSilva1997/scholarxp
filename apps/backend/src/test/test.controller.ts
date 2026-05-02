// Defines a minimal test endpoint used to verify that the backend can reach
// its Prisma-managed database during development and integration checks.
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('test')
export class TestController {
  // Uses NestJS dependency injection to access the shared Prisma repository layer.
  constructor(private prisma: PrismaService) {}

  // Returns a lightweight database-backed health response without exposing user data.
  @Get()
  async test() {
    // Counting users verifies database connectivity while avoiding retrieval of sensitive records.
    const users = await this.prisma.user.count();
    return { users };
  }
}
