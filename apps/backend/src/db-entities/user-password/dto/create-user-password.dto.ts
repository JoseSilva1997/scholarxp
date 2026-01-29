import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserPasswordDto {
  @IsInt()
  @IsNotEmpty()
  userId: number;

  @IsString()
  @IsNotEmpty()
  passwordHash: string;
}
