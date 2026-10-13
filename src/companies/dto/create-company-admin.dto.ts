import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateCompanyAdminDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  login: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
