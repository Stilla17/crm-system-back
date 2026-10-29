import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateEmployeeDto } from './create-employee.dto.js';

export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['userId'] as const),
) {
  @IsOptional()
  @IsString()
  roleId?: string;
}
