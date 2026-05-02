// Minimal creation payload; totalExp is intentionally absent because new avatars always start at 0.
import { IsInt, IsNotEmpty } from 'class-validator';

export class CreateAvatarDto {
  @IsInt()
  @IsNotEmpty()
  userId: number;
}
