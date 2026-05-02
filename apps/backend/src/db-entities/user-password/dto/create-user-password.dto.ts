// Input shape for persisting a new hashed password. The caller (AuthService) must hash
// the plaintext with bcrypt before constructing this DTO.
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserPasswordDto {
  @IsInt()
  @IsNotEmpty()
  userId: number;

  @IsString()
  @IsNotEmpty()
  passwordHash: string;
}
