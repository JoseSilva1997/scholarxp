import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { TestController } from './test/test.controller';
import { InstitutionModule } from './institution/institution.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    InstitutionModule,
  ],
  controllers: [TestController],
})
export class AppModule {}
