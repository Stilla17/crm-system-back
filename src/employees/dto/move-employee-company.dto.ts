import { IsNotEmpty, IsString } from 'class-validator';

export class MoveEmployeeCompanyDto {
  @IsString()
  @IsNotEmpty()
  targetCompanyId: string;
}
