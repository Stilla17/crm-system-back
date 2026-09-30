import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const login = dto.login.toLowerCase().trim();
    const user = await this.usersService.findByLogin(login);

    if (!user) {
      throw new UnauthorizedException();
    }

    const isPassword = await bcrypt.compare(dto.password, user.password);

    if (!isPassword) {
      throw new UnauthorizedException("Login yoki parol noto'g'ri");
    }

    const payload = {
      sub: user.id.toString(),
      roleId: user.roleId,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken };
  }
}
