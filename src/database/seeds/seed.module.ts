import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Role, RoleSchema } from '../../roles/schemas/role.schema.js';
import { User, UserSchema } from '../../users/schemas/user.schema.js';
import { SuperAdminSeed } from './super-admin.seed.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Role.name,
        schema: RoleSchema,
      },
      {
        name: User.name,
        schema: UserSchema,
      },
    ]),
  ],
  providers: [SuperAdminSeed],
  exports: [SuperAdminSeed],
})
export class SeedModule {}
