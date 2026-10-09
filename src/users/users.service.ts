import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from './schemas/user.schema.js';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { CreateUserDto } from './dto/create-user.dto.js';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { RolesService } from '../roles/roles.service.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly rolesService: RolesService,
  ) {}

  async getAllUsers(companyId: string) {
    return this.userModel.find({ companyId }).sort({ createdAt: -1 }).exec();
  }

  async getUserById(id: string) {
    const user = await this.userModel.findOne({ id });

    if (!user) {
      throw new NotFoundException('User Not Found');
    }

    return user;
  }

  async getUserByIdForCompany(id: string, companyId: string) {
    const user = await this.userModel.findOne({ id, companyId }).exec();

    if (!user) {
      throw new NotFoundException('User topilmadi');
    }

    return user;
  }

  async getUserByIdWithRefreshToken(id: string) {
    const user = await this.userModel
      .findOne({ id })
      .select('+refreshToken')
      .exec();
    if (!user) {
      throw new NotFoundException('User Not Found');
    }
    return user;
  }

  async createUser(dto: CreateUserDto, companyId: string) {
    const login = dto.login.toLocaleLowerCase().trim();
    await this.rolesService.getRoleById(dto.roleId, companyId);
    const existingUser = await this.userModel.findOne({
      login,
    });

    if (existingUser) {
      throw new ConflictException('Bunday login bazada mavjud');
    }

    //Praolni hashlash 2^10
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Foydalanuvchini saqlash
    const newUser = await this.userModel.create({
      ...dto,
      companyId,
      login,
      password: passwordHash,
    });

    return newUser;
  }

  async updateUser(id: string, dto: UpdateUserDto, companyId: string) {
    if (dto.roleId) {
      await this.rolesService.getRoleById(dto.roleId, companyId);
    }
    const user = await this.userModel.findOneAndUpdate({ id, companyId }, dto, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      throw new NotFoundException('User topilmadi');
    }

    return user;
  }

  async deleteUser(id: string, companyId: string) {
    const user = await this.userModel.findOneAndDelete({ id, companyId });

    if (!user) {
      throw new NotFoundException('User topilmadi');
    }

    return { message: "User o'chirildi" };
  }

  async findByLogin(login: string) {
    return this.userModel.findOne({ login }).select('+password');
  }

  async updateRefreshToken(id: string, refreshToken: string | null) {
    let hash: string | null = null;
    if (refreshToken) {
      hash = await bcrypt.hash(refreshToken, 10);
    }

    await this.userModel.findOneAndUpdate({ id }, { refreshToken: hash });
  }
}
