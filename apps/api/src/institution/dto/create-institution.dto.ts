import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateInstitutionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  lmsPlatform: string;

  @IsUrl()
  @IsNotEmpty()
  lmsIssuerUrl: string;

  @IsString()
  @IsNotEmpty()
  lmsClientId: string;

  @IsString()
  @IsNotEmpty()
  lmsDeploymentId: string;

  @IsUrl()
  @IsNotEmpty()
  jwksUrl: string;

  @IsUrl()
  @IsNotEmpty()
  authTokenUrl: string;

  @IsUrl()
  @IsNotEmpty()
  authRequestUrl: string;
}
