// AuthController handles authentication entry points and keeps logic thin by deferring to AuthService.
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { FRONTEND_URL } from '@scholarxp/constants';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { AuthenticatedGuard } from './guards/authenticated.guard';
import type { AuthUser } from '../types/auth-user.type';

@Controller('auth')
@UseGuards(ThrottlerGuard) // coarse guard; per-route limits below fine-tune if needed
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.register(dto);
    await this.authService.regenerateSession(req);
    this.setCsrfHeader(req, res);
    // We do not log users in until they verify email; keep session unauthenticated.
    return {
      user: this.authService.attachCapabilities(user),
      pendingEmailVerification: true,
    };
  }

  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // AuthGuard(local) puts user on req.user if validate succeeds.
    const user = req.user as AuthUser;
    this.logger.debug(
      `Login attempt userId=${user?.id ?? 'unknown'} session=${
        (req as unknown as { sessionID?: string }).sessionID ?? 'none'
      } csrfHeader=${(req.headers['x-csrf-token'] as string | undefined)?.slice(0, 8) ?? 'none'}`,
    );
    await this.authService.loginUser(req, user);
    this.setCsrfHeader(req, res);
    this.logger.debug(
      `Login success userId=${user.id} session=${
        (req as unknown as { sessionID?: string }).sessionID ?? 'none'
      }`,
    );
    return { user: this.authService.attachCapabilities(user) };
  }

  @Post('verify-email')
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.verifyEmail(dto.token);
    await this.authService.loginUser(req, user);
    this.setCsrfHeader(req, res);
    return { user: this.authService.attachCapabilities(user) };
  }

  @Post('resend-verification')
  async resendVerification(
    @Body() dto: ResendVerificationDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.resendVerification(dto.email);
    this.setCsrfHeader(req, res);
    return result;
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Make logout idempotent: clear session when present; otherwise just respond ok.
    if (req.isAuthenticated?.() === true) {
      this.logger.debug(
        `Logout request session=${
        (req as unknown as { sessionID?: string }).sessionID ?? 'none'
      } userId=${(req.user as AuthUser | undefined)?.id ?? 'unknown'}`,
      );
      const nextToken = await this.authService.logout(req, res);
      // Return token so client cannot miss the rotation when session is replaced.
      return { ok: true, csrfToken: nextToken };
    }
    // CSRF is skipped for logout; still emit a fresh token for the next session/bootstrap even when already logged out.
    const nextToken = await this.authService.logout(req, res);
    return { ok: true, csrfToken: nextToken };
  }

  @Get('me')
  me(@Req() req: Request) {
    const user = req.user as AuthUser | undefined;
    if (!user) {
      return { user: null };
    }
    return { user: this.authService.attachCapabilities(user) };
  }

  @Get('csrf')
  csrf(@Req() req: Request) {
    // Surface the CSRF token so unauthenticated clients can fetch it before posting credentials.
    const tokenFn = (req as unknown as { csrfToken?: () => string }).csrfToken;
    const csrfToken = typeof tokenFn === 'function' ? tokenFn() : null;
    return { csrfToken };
  }

  private setCsrfHeader(req: Request, res: Response) {
    const nextToken = this.getCsrfToken(req);
    if (nextToken) {
      res.setHeader('x-csrf-token', nextToken);
    }
  }

  private getCsrfToken(req: Request): string | null {
    const tokenFn = (req as unknown as { csrfToken?: () => string }).csrfToken;
    if (typeof tokenFn === 'function') {
      try {
        return tokenFn();
      } catch {
        return null;
      }
    }
    return null;
  }

  @Get('oauth/google')
  @UseGuards(AuthGuard('google'))
  // Passport handles redirect to Google; nothing else needed here.
  googleAuth() {
    return { ok: true };
  }

  @Get('oauth/google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = await this.authService.loginWithGoogle(req.user);
    await this.authService.loginUser(req, user);
    const redirectTarget = process.env.CORS_ORIGIN ?? FRONTEND_URL;
    res.redirect(redirectTarget);
  }
}
