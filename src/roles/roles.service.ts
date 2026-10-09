import {
  ConflictException,
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

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name)
    private readonly roleModel: Model<Role>,
  ) {}
  // Role yaratadi
  async createRole(dto: CreateRoleDto, companyId: string) {
    const slug = dto.slug.toLowerCase().trim();
    try {
      return await this.roleModel.create({
        ...dto,
        slug,
        companyId,
        scope: RoleScope.COMPANY,
      });
    } catch (error: unknown) {
      if (isMongoDuplicateKeyError(error)) {
        throw new ConflictException('Bunday rol mavjud');
      }

      throw error;
    }
  }

  //   Barcha Rolellarni olib keladi
  async getAllRoles(companyId: string) {
    return this.roleModel.find({ companyId }).sort({ createdAt: -1 }).exec();
  }

  //   Bitta Role olib kelish
  async getRoleById(id: string, companyId: string) {
    const role = await this.roleModel.findOne({ id, companyId }).exec();

    if (!role) {
      throw new NotFoundException('Rol topilmadi');
    }

    return role;
  }

  //   Update Role
  async updateRole(id: string, dto: UpdateRoleDto, companyId: string) {
    try {
      const updateData = {
        ...dto,
        ...(dto.slug !== undefined
          ? { slug: dto.slug.toLowerCase().trim() }
          : {}),
      };
      const role = await this.roleModel.findOneAndUpdate(
        { id, companyId },
        { $set: updateData },
        {
          new: true,
          runValidators: true,
        },
      );

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

  // auth method
  async findRoleForAuth(id: string) {
    return this.roleModel.findOne({ id }).exec();
  }
}
