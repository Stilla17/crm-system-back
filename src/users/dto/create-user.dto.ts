import {
  IsArray,
  IsEnum,
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
  @MinLength(6)
  @Exclude({ toPlainOnly: true })
  password: string;

  @IsString()
  @IsNotEmpty()
  login: string;

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;
}
