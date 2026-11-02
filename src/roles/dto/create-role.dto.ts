import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
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
  isCompanyAdmin?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^[a-z][a-z0-9-]*$/, { each: true })
  allowedSections?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
