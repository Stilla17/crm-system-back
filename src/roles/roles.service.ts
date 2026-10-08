import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel, SchemaFactory } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { Role } from './schemas/role.schema.js';
import { isMongoDuplicateKeyError } from '../common/utils/mongo-error.util.js';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name)
    private readonly roleModel: Model<Role>,
  ) {}
  // Role yaratadi
  async createRole(dto: CreateRoleDto) {
    const slug = dto.slug.toLowerCase().trim();
    try {
      return await this.roleModel.create({ ...dto, slug });
    } catch (error: unknown) {
      if (isMongoDuplicateKeyError(error)) {
        throw new ConflictException('Bunday rol mavjud');
      }

      throw error;
    }
  }

  //   Barcha Rolellarni olib keladi
  async getAllRoles() {
    return this.roleModel.find().sort({ createAt: -1 }).exec();
  }

  //   Bitta Role olib kelish
  async getRoleById(id: string) {
    const role = await this.roleModel.findOne({ id });

    if (!role) {
      throw new NotFoundException('Rol topilmadi');
    }

    return role;
  }

  //   Update Role
  async updateRole(id: string, dto: UpdateRoleDto) {
    try {
      const updateData = {
        ...dto,
        ...(dto.slug !== undefined
          ? { slug: dto.slug.toLowerCase().trim() }
          : {}),
      };
      const role = await this.roleModel.findOneAndUpdate(
        { id },
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

  //   Delete Role
  async deleteRole(id: string) {
    const role = await this.roleModel.findOneAndUpdate(
      { id },
      {
        $set: {
          isActive: false,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!role) {
      throw new NotFoundException('Rol topilmadi');
    }

    return {
      message: "Role o'chirildi",
      role,
    };
  }
}

export const RoleSchema = SchemaFactory.createForClass(Role);

RoleSchema.index({ companyId: 1, slug: 1 }, { unique: true });
