// AuthController handles authentication entry points and keeps logic thin by deferring to AuthService.
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { FRONTEND_URL } from '../constants';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { AuthenticatedGuard } from './guards/authenticated.guard';
import type { AuthUser } from '../types/auth-user.type';

@Controller('auth')
@UseGuards(ThrottlerGuard) // coarse guard; per-route limits below fine-tune if needed
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const user = await this.authService.register(dto);
    await this.authService.regenerateSession(req);
    // We do not log users in until they verify email; keep session unauthenticated.
    return {
      user: this.authService.attachCapabilities(user),
      pendingEmailVerification: true,
    };
  }

  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Req() req: Request) {
    // AuthGuard(local) puts user on req.user if validate succeeds.
    const user = req.user as AuthUser;
    await this.authService.loginUser(req, user);
    return { user: this.authService.attachCapabilities(user) };
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    const user = await this.authService.verifyEmail(dto.token);
    await this.authService.loginUser(req, user);
    return { user: this.authService.attachCapabilities(user) };
  }

  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }

  @UseGuards(AuthenticatedGuard)
  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    await this.authService.logout(req, res);
    return { ok: true };
  }

  @Get('me')
  me(@Req() req: Request) {
    const user = req.user as AuthUser | undefined;
    if (!user) {
      return { user: null };
    }
    return { user: this.authService.attachCapabilities(user) };
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
