import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Role } from './schema/role.schema.js';
import { Model } from 'mongoose';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name)
    private readonly roleModel: Model<Role>,
  ) {}
  // Role yaratadi
  async createRole(dto: CreateRoleDto) {
    const existingRole = await this.roleModel.findOne({
      slug: dto.slug.toLowerCase().trim(),
    });

    if (existingRole) {
      throw new ConflictException('Bunday rol mavjud');
    }

    return this.roleModel.create(dto);
  }

  //   Barcha Rolellarni olib keladi
  async getAllRoles() {
    return this.roleModel.find().sort({ createAt: -1 });
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
    const role = await this.roleModel.findOneAndUpdate({ id }, dto, {
      new: true,
      runValidators: true,
    });

    if (!role) {
      throw new NotFoundException('Rol topilmadi');
    }

    return role;
  }

  //   Delete Role
  async deleteRole(id: string) {
    const role = await this.roleModel.findOneAndDelete({ id });

    if (!role) {
      throw new NotFoundException('Rol topilmadi');
    }

    return { message: "Role o'chirildi" };
  }
}
