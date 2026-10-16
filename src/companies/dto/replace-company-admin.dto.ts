import { IsNotEmpty, IsString } from 'class-validator';

export class ReplaceCompanyAdminDto {
  @IsString()
  @IsNotEmpty()
  newAdminId: string;
}
