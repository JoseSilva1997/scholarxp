import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// This controller provides a lightweight health probe that confirms API + DB connectivity 
// in non-production environments.
@Controller('test')
export class TestController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async test() {
    const users = await this.prisma.user.count();
    return { users };
  }
}
