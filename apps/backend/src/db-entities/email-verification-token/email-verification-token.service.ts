import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { EmailVerificationToken, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// 'numeric' = short 6-digit code transcribed from email; 'url' = long opaque token embedded in a link.
type TokenStyle = 'numeric' | 'url';

type IssueTokenParams = {
  userId: number;
  reason?: string;
  ttlMinutes?: number;
  reuseExisting?: boolean;
  tokenStyle?: TokenStyle;
};

@Injectable()
export class EmailVerificationTokenService {
  private readonly logger = new Logger(EmailVerificationTokenService.name);
  private readonly tokenLength = 6;
  private readonly defaultTtlMinutes = 15;
  private readonly minTtlMinutes = 10;
  private readonly maxTtlMinutes = 30;
  private readonly maxTokenGenerationAttempts = 5;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Issues a one-time code for the given user and reason.
   * - Reuses an existing unexpired token when requested to avoid spamming inboxes.
   * - Enforces a single active token per user+reason by deleting other pending rows in the same transaction.
   */
  async issueToken(params: IssueTokenParams): Promise<EmailVerificationToken> {
    const now = new Date();
    const reason = params.reason ?? 'signup';
    const ttlMinutes = this.clampTtl(params.ttlMinutes);
    const expiresAt = this.addMinutes(now, ttlMinutes);
    const tokenStyle: TokenStyle = params.tokenStyle ?? 'numeric';

    if (params.reuseExisting) {
      const active = await this.findActiveToken(params.userId, reason, now);
      if (active) {
        return active;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.deleteMany({
        where: { userId: params.userId, reason, consumedAt: null },
      });

      return this.createWithRetry(
        tx,
        {
          userId: params.userId,
          reason,
          expiresAt,
        },
        tokenStyle,
      );
    });
  }

  /**
   * Marks the token consumed if still valid; otherwise throws a user-facing error.
   * This keeps the caller agnostic to whether the token was missing, expired, or already used.
   * When `expectedReason` is provided, a token issued for a different reason is rejected without
   * being consumed so it stays usable for its original flow (e.g., a signup code can't double as a reset code).
   */
  async consumeToken(
    token: string,
    expectedReason?: string,
  ): Promise<EmailVerificationToken> {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!record) {
      throw new BadRequestException('Invalid or expired verification code.');
    }

    if (expectedReason && record.reason !== expectedReason) {
      // Reject with the same generic error so callers can't infer that a token exists for a different reason.
      throw new BadRequestException('Invalid or expired verification code.');
    }

    const now = new Date();
    if (record.consumedAt || record.expiresAt <= now) {
      // Eagerly clean up expired/used tokens so later requests do not have to re-check.
      await this.prisma.emailVerificationToken.delete({
        where: { token },
      });
      throw new BadRequestException('Invalid or expired verification code.');
    }

    return this.prisma.emailVerificationToken.update({
      where: { token },
      data: { consumedAt: now },
    });
  }

  /**
   * Prunes expired tokens to keep the table small; intended to be called by a cron/queue runner.
   */
  async pruneExpired(): Promise<number> {
    const now = new Date();
    const { count } = await this.prisma.emailVerificationToken.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return count;
  }

  private async createWithRetry(
    tx: Prisma.TransactionClient,
    data: Pick<
      Prisma.EmailVerificationTokenUncheckedCreateInput,
      'userId' | 'reason' | 'expiresAt'
    >,
    tokenStyle: TokenStyle,
  ): Promise<EmailVerificationToken> {
    for (
      let attempt = 0;
      attempt < this.maxTokenGenerationAttempts;
      attempt += 1
    ) {
      const token =
        tokenStyle === 'url' ? this.buildUrlToken() : this.buildNumericToken();
      try {
        return await tx.emailVerificationToken.create({
          data: { ...data, token },
        });
      } catch (error) {
        if (this.isUniqueConstraint(error)) {
          this.logger.warn(
            `Token collision on attempt ${attempt + 1}; retrying new code for user ${data.userId}`,
          );
          continue;
        }
        throw error;
      }
    }

    throw new InternalServerErrorException(
      'Failed to generate a unique verification token after multiple attempts.',
    );
  }

  private async findActiveToken(userId: number, reason: string, now: Date) {
    return this.prisma.emailVerificationToken.findFirst({
      where: { userId, reason, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private buildNumericToken(): string {
    // We use a short numeric code so users can transcribe it from email without friction.
    let token = '';
    for (let i = 0; i < this.tokenLength; i += 1) {
      token += Math.floor(Math.random() * 10);
    }
    return token;
  }

  // 32 random bytes -> 64-char hex; safe for URL query strings and large enough that
  // brute-forcing a single account in the 30-minute TTL window is computationally infeasible.
  private buildUrlToken(): string {
    return randomBytes(32).toString('hex');
  }

  private clampTtl(ttlMinutes?: number): number {
    const ttl = ttlMinutes ?? this.defaultTtlMinutes;
    if (ttl < this.minTtlMinutes) {
      return this.minTtlMinutes;
    }
    if (ttl > this.maxTtlMinutes) {
      return this.maxTtlMinutes;
    }
    return ttl;
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60_000);
  }

  private isUniqueConstraint(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
