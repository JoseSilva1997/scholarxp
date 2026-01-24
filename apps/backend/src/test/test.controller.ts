import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('test')
export class TestController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async test() {
    const users = await this.prisma.user.count();
    return { users };
  }
}
