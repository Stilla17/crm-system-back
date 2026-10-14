import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class CreateCompanyAdminDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  middleName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+998\d{9}$/)
  phone: string;

  @IsString()
  @IsNotEmpty()
  login: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
