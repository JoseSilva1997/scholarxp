import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, type GoogleIdentity } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { FRONTEND_URL } from '../constants';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register-by-email')
  async registerByEmail(@Body() dto: RegisterDto, @Req() req: Request) {
    const user = await this.authService.registerByEmail(dto);
    // Do not start a session until the email is verified; client should direct to code entry screen.
    req.session.userId = undefined;
    return { user };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const user = await this.authService.login(dto);
    req.session.userId = user.id;
    return { user };
  }

  @Post('verify-email')
  async verifyEmail(@Body('token') token: string, @Req() req: Request) {
    const user = await this.authService.verifyEmail(token);
    req.session.userId = user.id;
    return { user };
  }

  @Post('resend-verification')
  async resendVerification(@Body('email') email: string) {
    return this.authService.resendVerification(email);
  }

  @Post('logout')
  async logout(@Req() req: Request) {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        resolve();
      });
    });
    return { ok: true };
  }

  @Get('me')
  async me(@Req() req: Request) {
    const userId = req.session.userId;
    if (!userId) {
      return { user: null };
    }
    const user = await this.authService.getUserById(userId);
    return { user };
  }

  @Get('oauth/google')
  @UseGuards(AuthGuard('google'))
  // Entry point: Passport redirects to Google; logic handled by strategy.
  googleAuth() {
    return { ok: true };
  }

  @Get('oauth/google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as GoogleIdentity & { picture?: string };

    const user = await this.authService.loginWithGoogle(profile);
    req.session.userId = user.id;

    // Frontend listens for session cookie; redirect back to app root so it can call /auth/me.
    const redirectTarget = process.env.CORS_ORIGIN ?? FRONTEND_URL;
    res.redirect(redirectTarget);
  }
}
