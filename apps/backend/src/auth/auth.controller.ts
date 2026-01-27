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
import { AuthService } from './auth.service';
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
    req.session.userId = user.id;
    return { user };
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const user = await this.authService.login(dto);
    req.session.userId = user.id;
    return { user };
  }

  @Post('logout')
  async logout(@Req() req: Request) {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          reject(err);
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
  async googleAuth() {
    return { ok: true };
  }

  @Get('oauth/google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const profile = req.user as {
      providerUserId: string;
      email: string | null;
      firstName: string;
      lastName: string;
      picture?: string;
    };

    const user = await this.authService.loginWithGoogle(profile);
    req.session.userId = user.id;

    // Frontend listens for session cookie; redirect back to app root so it can call /auth/me.
    const redirectTarget = process.env.CORS_ORIGIN ?? FRONTEND_URL;
    res.redirect(redirectTarget);
  }
}
