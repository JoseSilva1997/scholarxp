// Input shape for requesting a new verification token; reason and TTL are optional to support
// multiple email flows (signup, password reset) without separate DTO classes.
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEmailVerificationTokenDto {
  @IsInt()
  @Min(1)
  userId: number;

  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  @IsString()
  @IsOptional()
  @MaxLength(64)
  reason?: string;

  // Allow callers to request a custom TTL while keeping it inside a safe window.
  @IsInt()
  @IsOptional()
  @Min(10)
  @Max(30)
  ttlMinutes?: number;

  // When true we reuse a still-valid token instead of issuing a fresh one to avoid noisy emails.
  @IsBoolean()
  @IsOptional()
  reuseActive?: boolean;
}
