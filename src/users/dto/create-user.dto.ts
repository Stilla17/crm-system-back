import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
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
  middleName: string;

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

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+998\d{9}$/)
  phone: string;

  @IsString()
  @IsNotEmpty()
  date?: string;

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;
}
