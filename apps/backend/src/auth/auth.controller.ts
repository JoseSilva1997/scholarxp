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
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { AuthUser } from '@scholarxp/api-contracts';
import { CaptureRedirectGuard } from './guards/capture-redirect.guard';

@Controller('auth')
@UseGuards(ThrottlerGuard) // coarse guard; per-route limits below fine-tune if needed
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  // POST /auth/register: create a new local-auth account. Session is regenerated to mint a fresh
  // CSRF secret for the unauthenticated client; the user is intentionally not logged in here.
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.register(dto);
    await this.authService.regenerateSession(req);
    this.authService.attachCsrfHeader(req, res);
    // We do not log users in until they verify email; keep session unauthenticated.
    return {
      user: this.authService.attachCapabilities(user),
      pendingEmailVerification: true,
    };
  }

  // POST /auth/login: validate email/password via Passport's local strategy, establish session,
  // and return the authenticated user with capability list attached.
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
    this.authService.attachCsrfHeader(req, res);
    this.logger.debug(
      `Login success userId=${user.id} session=${
        (req as unknown as { sessionID?: string }).sessionID ?? 'none'
      }`,
    );
    return { user: this.authService.attachCapabilities(user) };
  }

  // POST /auth/verify-email: confirm ownership of the email via a one-time token and log the
  // user in immediately so they don't have to re-enter credentials post-verification.
  @Post('verify-email')
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.verifyEmail(dto.token);
    await this.authService.loginUser(req, user);
    this.authService.attachCsrfHeader(req, res);
    return { user: this.authService.attachCapabilities(user) };
  }

  // POST /auth/resend-verification: re-send the signup verification code to a known email.
  @Post('resend-verification')
  async resendVerification(
    @Body() dto: ResendVerificationDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.resendVerification(dto.email);
    this.authService.attachCsrfHeader(req, res);
    return result;
  }

  // POST /auth/forgot-password: trigger a password-reset email. Always returns 200 to avoid
  // account enumeration; see AuthService.requestPasswordReset for the deliberate exception.
  @Post('forgot-password')
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.requestPasswordReset(dto.email);
    this.authService.attachCsrfHeader(req, res);
    return result;
  }

  // POST /auth/reset-password: complete the reset using the token from the emailed link.
  @Post('reset-password')
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.resetPassword(
      dto.token,
      dto.password,
    );
    this.authService.attachCsrfHeader(req, res);
    return result;
  }

  // POST /auth/logout: clear the Passport session and rotate to a fresh anonymous one. Idempotent
  // by design so an unauthenticated client posting here still receives a usable CSRF token back.
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (req.isAuthenticated?.() === true) {
      this.logger.debug(
        `Logout request session=${
          (req as unknown as { sessionID?: string }).sessionID ?? 'none'
        } userId=${(req.user as AuthUser | undefined)?.id ?? 'unknown'}`,
      );
    }
    // Logout is idempotent: service rotates the session and emits a fresh CSRF token either way.
    const nextToken = await this.authService.logout(req, res);
    return { ok: true, csrfToken: nextToken };
  }

  // GET /auth/me: identity probe used by the frontend on app boot. Returns null when no session
  // exists rather than 401 so the public landing flow does not need to swallow errors.
  @Get('me')
  me(@Req() req: Request) {
    const user = req.user as AuthUser | undefined;
    if (!user) {
      return { user: null };
    }
    return { user: this.authService.attachCapabilities(user) };
  }

  // GET /auth/csrf: hand the current CSRF token to anonymous clients so they can perform their
  // first state-changing POST (e.g. login or register).
  @Get('csrf')
  csrf(@Req() req: Request) {
    // Surface the CSRF token so unauthenticated clients can fetch it before posting credentials.
    return { csrfToken: this.authService.tryGenerateCsrfToken(req) };
  }

  // GET /auth/oauth/google: kick off the Google OAuth handshake. CaptureRedirectGuard runs first
  // to persist any ?redirect= target into the session before Passport issues its 302.
  @Get('oauth/google')
  @UseGuards(CaptureRedirectGuard, AuthGuard('google'))
  // Guards handle redirect; handler exists to satisfy Nest route requirements.
  googleAuth() {
    return { ok: true };
  }

  // GET /auth/oauth/google/callback: terminates the OAuth round-trip; service handles linking,
  // session creation, and the final redirect back to the SPA.
  @Get('oauth/google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    await this.authService.handleGoogleCallback(req, res);
  }
}
