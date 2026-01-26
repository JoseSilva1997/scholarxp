import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

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
}
