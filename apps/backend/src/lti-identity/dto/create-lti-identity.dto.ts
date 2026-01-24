import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateLtiIdentityDto {
  @IsInt()
  @IsNotEmpty()
  institutionId: number;

  @IsInt()
  @IsNotEmpty()
  userId: number;

  @IsString()
  @IsNotEmpty()
  ltiUserId: string;
}
