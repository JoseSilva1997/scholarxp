import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { TestController } from './test/test.controller';
import { InstitutionModule } from './institution/institution.module';
import { UsersModule } from './users/users.module';
import { LtiIdentityModule } from './lti-identity/lti-identity.module';
import { AvatarModule } from './avatar/avatar.module';
import { ModuleModule } from './module/module.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
    }),
    PrismaModule,
    InstitutionModule,
    UsersModule,
    LtiIdentityModule,
    AvatarModule,
    ModuleModule,
  ],
  controllers: [TestController],
})
export class AppModule {}
