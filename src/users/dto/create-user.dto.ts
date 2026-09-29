import {
  IsEnum,
  isNotEmpty,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserStatus } from '../schemas/user.schema.js';
import { Exclude } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  roleId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Exclude()
  password: string;

  @IsString()
  @IsNotEmpty()
  login: string;

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;
}
