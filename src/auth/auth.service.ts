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

  // Ikkala tokkenni olib yasab berish uchun method
  async getTokens(userId: string, roleId: string, login: string) {
    const payload = {
      sub: userId,
      login,
      roleId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '1d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  // Login
  async login(dto: LoginDto) {
    const login = dto.login.toLowerCase().trim();
    const user = await this.usersService.findByLogin(login);

    if (!user) {
      throw new UnauthorizedException('Bunday user mavjud emas');
    }

    const isPassword = await bcrypt.compare(dto.password, user.password);

    if (!isPassword) {
      throw new UnauthorizedException("Login yoki parol noto'g'ri");
    }

    const tokens = await this.getTokens(
      user.id.toString(),
      user.roleId,
      user.login,
    );

    await this.usersService.updateRefreshToken(
      user.id.toString(),
      tokens.refreshToken,
    );

    return tokens;
  }
  // Refresh (Yangi acces token olish)
  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersService.getUserByIdWithRefreshToken(userId);

    if (!user.refreshToken) {
      throw new UnauthorizedException('Kirish taqiqlangan');
    }

    const tokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);

    if (!tokenMatches) {
      throw new UnauthorizedException('Yaroqsiz refresh token');
    }

    const tokens = await this.getTokens(
      user.id.toString(),
      user.roleId,
      user.login,
    );

    await this.usersService.updateRefreshToken(
      user.id.toString(),
      tokens.refreshToken,
    );
    return tokens;
  }

  // Logout (Refresh tokenni o'chirish)
  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
    return { message: 'User logged out successfully' };
  }
}
