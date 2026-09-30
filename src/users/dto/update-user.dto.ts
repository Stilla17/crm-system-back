import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto.js';

// Login va parolni ozgartrb bolmaydi
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'login'] as const),
) {}
