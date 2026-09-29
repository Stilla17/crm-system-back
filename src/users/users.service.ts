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

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async getAllUsers() {
    return this.userModel.find().sort({ createAt: -1 });
  }

  async getUserById(id: string) {
    const user = this.userModel.findOne({ id });

    if (!user) {
      throw new NotFoundException('User Not Found');
    }

    return user;
  }

  async createUser(dto: CreateUserDto) {
    const login = dto.login.toLocaleLowerCase().trim();
    const existingUser = await this.userModel.findOne({
      login,
    });

    if (existingUser) {
      throw new ConflictException('Bunday login bazada mavjud');
    }

    //Praolni hashlash 2^10
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    // Foydalanuvchini saqlash
    const newUser = await this.userModel.create({
      ...dto,
      login,
      password: passwordHash,
    });

    return newUser;
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const user = this.userModel.findOneAndUpdate({ id }, dto, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      throw new NotFoundException('User topilmadi');
    }

    return user;
  }

  async deleteUser(id: string) {
    const user = this.userModel.findOneAndDelete({ id });

    if (!user) {
      throw new NotFoundException('User topilmadi');
    }

    return { message: "User o'chirildi" };
  }
}
