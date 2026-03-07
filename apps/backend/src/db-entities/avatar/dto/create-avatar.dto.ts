import { IsInt, IsNotEmpty } from 'class-validator';

export class CreateAvatarDto {
  @IsInt()
  @IsNotEmpty()
  userId: number;
}
