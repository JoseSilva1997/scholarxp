import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { TestController } from './test/test.controller';
import { InstitutionModule } from './db-entities/institution/institution.module';
import { UsersModule } from './db-entities/users/users.module';
import { LtiIdentityModule } from './db-entities/lti-identity/lti-identity.module';
import { AuthIdentityModule } from './db-entities/auth-identity/auth-identity.module';
import { AvatarModule } from './db-entities/avatar/avatar.module';
import { ModuleModule } from './db-entities/module/module.module';
import { UserModuleModule } from './db-entities/user-module/user-module.module';
import { ModuleInviteModule } from './db-entities/module-invite/module-invite.module';
import { ModuleUnitModule } from './db-entities/module-unit/module-unit.module';
import { PracticeSessionModule } from './db-entities/practice-session/practice-session.module';
import { ModuleUnitQuestionGroupModule } from './db-entities/module-unit-question-group/module-unit-question-group.module';
import { QuestionUnitModule } from './db-entities/questions/question-unit/question-unit.module';
import { QuestionContentModule } from './db-entities/questions/question-content/question-content.module';
import { QuestionVariantModule } from './db-entities/questions/question-variant/question-variant.module';
import { QuestionAttemptModule } from './db-entities/question-attempt/question-attempt.module';
import { DailyPracticeModule } from './daily-practice/daily-practice.module';
import { AuthModule } from './auth/auth.module';
import { EmailVerificationTokenModule } from './db-entities/email-verification-token/email-verification-token.module';
import { MailerModule } from './mailer/mailer.module';
import { PracticeRoomModule } from './practice-room/practice-room.module';
import { ProfileModule } from './profile/profile.module';
import { QuestsModule } from './quests/quests.module';
import { RosterModule } from './roster/roster.module';

// Keep internal diagnostics routes out of production to reduce attack surface.
const appControllers =
  process.env.NODE_ENV === 'production' ? [] : [TestController];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Resolve per-environment config first, then fall back to development for local/test workflows.
      envFilePath: [
        `.env.${process.env.NODE_ENV ?? 'development'}`,
        '.env.development',
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    InstitutionModule,
    UsersModule,
    LtiIdentityModule,
    AuthIdentityModule,
    AvatarModule,
    ModuleModule,
    UserModuleModule,
    ModuleInviteModule,
    ModuleUnitModule,
    PracticeSessionModule,
    ModuleUnitQuestionGroupModule,

    QuestionUnitModule,
    QuestionContentModule,
    QuestionVariantModule,
    QuestionAttemptModule,
    DailyPracticeModule,
    AuthModule,
    EmailVerificationTokenModule,
    MailerModule,
    PracticeRoomModule,
    QuestsModule,
    ProfileModule,
    RosterModule,
  ],
  controllers: appControllers,
})
export class AppModule {}
