import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Permission } from '../../auth/permissions/permissions.enum.js';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  roleName: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsArray()
  @IsEnum(Permission, { each: true })
  @ArrayUnique()
  @IsOptional()
  permissions?: Permission[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
