import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Role } from '../../roles/schemas/role.schema.js';
import { Model } from 'mongoose';
import { User, UserStatus } from '../../users/schemas/user.schema.js';
import { ConfigService } from '@nestjs/config';
import { RoleScope } from '../../roles/enum/role-scope.enum.js';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SuperAdminSeed {
  constructor(
    @InjectModel(Role.name)
    private readonly roleModel: Model<Role>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,

    private readonly configService: ConfigService,
  ) {}

  async run() {
    const login = this.configService
      .getOrThrow<string>('SUPER_ADMIN_LOGIN')
      .toLowerCase()
      .trim();

    const password =
      this.configService.getOrThrow<string>('SUPER_ADMIN_PASSWORD') ??
      'System Admin';

    const name =
      this.configService.getOrThrow<string>('SUPER_ADMIN_NAME') ??
      'System Admin';

    const superAdminRole = await this.roleModel.findOneAndUpdate(
      {
        slug: 'super-admin',
        scope: RoleScope.SYSTEM,
        companyId: null,
      },
      {
        $setOnInsert: {
          id: randomUUID(),
          roleName: 'Super Admin',
          slug: 'super-admin',
          scope: RoleScope.SYSTEM,
          companyId: null,
          permissions: [
            'companies.read',
            'companies.create',
            'companies.update',
            'companies.delete',

            'roles.read',
            'roles.create',
            'roles.update',

            'users.read',
            'users.create',
            'users.update',
            'users.delete',
          ],
          isActive: true,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      },
    );

    const existingUser = await this.userModel.findOne({ login }).exec();

    if (!existingUser) {
      const passwordHash = await bcrypt.hash(password, 10);

      await this.userModel.create({
        id: randomUUID(),
        name,
        login,
        password: passwordHash,
        companyId: null,
        roleId: superAdminRole.id,
        status: UserStatus.ACTIVE,
      });
    }
    return {
      message: 'SuperAdmin seed muvaffaqiyatli bajarildi',
      login,
    };
  }
}
