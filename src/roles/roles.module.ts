import { Module } from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { RolesController } from './roles.controller.js';
import { MongooseModule } from '@nestjs/mongoose';
import { Role, RoleSchema } from './schemas/role.schema.js';
import { PassportModule } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Role.name,
        schema: RoleSchema,
      },
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [RolesController],
  providers: [RolesService, PermissionsGuard],
  exports: [RolesService],
})
export class RolesModule {}
