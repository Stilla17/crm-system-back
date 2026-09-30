import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service.js';

// Token ichidagi payload tipi
interface JwtPayload {
  sub: string;
  roleId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      // Tokenni Request Header'dan (Authorization: Bearer <token>) oladi
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Muddati o'tgan tokenni avtomatik rad etadi (401 xato beradi)
      ignoreExpiration: false,
      // Tokenni tekshirish uchun maxfiy kalit (.env dan olinadi)
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.getUserById(payload.sub);

    if (!user) {
      throw new NotFoundException('Bunday user topilmadi');
    }

    if (!payload.sub) {
      throw new UnauthorizedException("Noto'g'ri token");
    }

    return {
      userId: payload.sub,
      roleId: payload.roleId,
    };
  }
}
