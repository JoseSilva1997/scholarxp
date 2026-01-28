import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { TestController } from './test/test.controller';
import { InstitutionModule } from './institution/institution.module';
import { UsersModule } from './users/users.module';
import { LtiIdentityModule } from './lti-identity/lti-identity.module';
import { AuthIdentityModule } from './auth-identity/auth-identity.module';
import { AvatarModule } from './avatar/avatar.module';
import { ModuleModule } from './module/module.module';
import { UserModuleModule } from './user-module/user-module.module';
import { ModuleInviteModule } from './module-invite/module-invite.module';
import { UserPasswordModule } from './user-password/user-password.module';
import { DailyQuestModule } from './daily-quest/daily-quest.module';
import { ModuleUnitModule } from './module-unit/module-unit.module';
import { PracticeSessionModule } from './practice-session/practice-session.module';
import { ModuleUnitQuestionGroupModule } from './module-unit-question-group/module-unit-question-group.module';
import { ModuleUnitUserProgressModule } from './module-unit-user-progress/module-unit-user-progress.module';
import { QuestionUnitModule } from './question-unit/question-unit.module';
import { QuestionContentModule } from './question-content/question-content.module';
import { QuestionVariantModule } from './question-variant/question-variant.module';
import { QuestionAttemptModule } from './question-attempt/question-attempt.module';
import { AuthModule } from './auth/auth.module';
import { EmailVerificationTokenModule } from './email-verification-token/email-verification-token.module';

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
    AuthIdentityModule,
    AvatarModule,
    ModuleModule,
    UserModuleModule,
    ModuleInviteModule,
    UserPasswordModule,
    DailyQuestModule,
    ModuleUnitModule,
    PracticeSessionModule,
    ModuleUnitQuestionGroupModule,
    ModuleUnitUserProgressModule,
    QuestionUnitModule,
    QuestionContentModule,
    QuestionVariantModule,
    QuestionAttemptModule,
    AuthModule,
    EmailVerificationTokenModule,
  ],
  controllers: [TestController],
})
export class AppModule {}
