import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { Role } from './schemas/role.schema.js';
import { isMongoDuplicateKeyError } from '../common/utils/mongo-error.util.js';
import { RoleScope } from './enum/role-scope.enum.js';
import { Permission } from '../auth/permissions/permissions.enum.js';
import { SYSTEM_ONLY_PERMISSIONS } from '../auth/permissions/role-permissions.js';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name)
    private readonly roleModel: Model<Role>,
  ) {}

  private validateCompanyPermissions(permissions?: Permission[]): void {
    if (!permissions) {
      return;
    }

    const hasSystemPermission = permissions.some((permission) =>
      SYSTEM_ONLY_PERMISSIONS.includes(permission),
    );

    if (hasSystemPermission) {
      throw new ForbiddenException(
        "Company role uchun system permission berib bo'lmaydi",
      );
    }
  }

  async createRole(dto: CreateRoleDto) {
    this.validateCompanyPermissions(dto.permissions);
    const slug = dto.slug.toLowerCase().trim();

    try {
      return await this.roleModel.create({
        ...dto,
        slug,
        scope: RoleScope.COMPANY,
      });
    } catch (error: unknown) {
      if (isMongoDuplicateKeyError(error)) {
        throw new ConflictException('Bunday rol mavjud');
      }

      throw error;
    }
  }

  async getAllRoles() {
    return this.roleModel
      .find({ scope: RoleScope.COMPANY })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getRoleById(id: string) {
    const role = await this.roleModel
      .findOne({ id, scope: RoleScope.COMPANY })
      .exec();

    if (!role) {
      throw new NotFoundException('Rol topilmadi');
    }

    return role;
  }

  async getAssignableRoleById(id: string) {
    const role = await this.roleModel
      .findOne({ id, scope: RoleScope.COMPANY, isActive: true })
      .exec();

    if (!role) {
      throw new NotFoundException('Faol company roli topilmadi');
    }

    return role;
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    this.validateCompanyPermissions(dto.permissions);

    const updateData = {
      ...dto,
      ...(dto.slug !== undefined
        ? { slug: dto.slug.toLowerCase().trim() }
        : {}),
    };

    try {
      const role = await this.roleModel
        .findOneAndUpdate(
          { id, scope: RoleScope.COMPANY },
          { $set: updateData },
          { new: true, runValidators: true },
        )
        .exec();

      if (!role) {
        throw new NotFoundException('Rol topilmadi');
      }

      return role;
    } catch (error: unknown) {
      if (isMongoDuplicateKeyError(error)) {
        throw new ConflictException('Bunday rol mavjud');
      }

      throw error;
    }
  }

  async getAllRolesForSystem() {
    return this.roleModel.find().sort({ createdAt: -1 }).exec();
  }

  async findRoleForAuth(id: string) {
    return this.roleModel.findOne({ id }).exec();
  }
}
