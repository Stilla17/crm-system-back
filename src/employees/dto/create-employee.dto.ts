import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { EmployeeGender } from '../schemas/employee.schema.js';

export class CreateEmployeeDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsEnum(EmployeeGender)
  gender: EmployeeGender;

  @IsOptional()
  @IsString()
  @Matches(/^\+998\d{9}$/)
  phone?: string;

  // dd.mm.yyyy
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}\.\d{2}\.\d{4}$/)
  birthDate?: string;

  @IsOptional()
  @IsString()
  jobId?: string;

  @IsOptional()
  @IsString()
  divisionId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locationIds?: string[];
}
