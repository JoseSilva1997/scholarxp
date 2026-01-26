import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthProvider } from '@prisma/client';
import bcrypt from 'bcryptjs';

export type AuthUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  globalRole: string;
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async registerByEmail(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });

      await tx.userPassword.create({
        data: {
          userId: createdUser.id,
          passwordHash,
        },
      });

      await tx.authIdentity.create({
        data: {
          userId: createdUser.id,
          provider: AuthProvider.local,
          providerUserId: email,
          email,
        },
      });

      return createdUser;
    });

    return this.toAuthUser(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const password = await this.prisma.userPassword.findUnique({
      where: { userId: user.id },
    });
    if (!password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, password.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.toAuthUser(user);
  }

  async getUserById(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new UnauthorizedException('Session invalid');
    }
    return this.toAuthUser(user);
  }

  private toAuthUser(user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string | null;
    globalRole: string;
  }): AuthUser {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      globalRole: user.globalRole,
    };
  }
}
