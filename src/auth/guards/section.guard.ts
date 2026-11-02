import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.type.js';
import { RoleScope } from '../../roles/enum/role-scope.enum.js';
import { REQUIRED_SECTION_KEY } from '../decorators/section.decarator.js';

@Injectable()
export class SectionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Kirish taqiqlangan');
    }

    const isSuperAdmin =
      user.roleScope === RoleScope.SYSTEM && user.companyId === null;

    if (isSuperAdmin) {
      return true;
    }

    const requiredSection = this.reflector.getAllAndOverride<string>(
      REQUIRED_SECTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredSection) {
      throw new ForbiddenException('Endpoint uchun bo‘lim ruxsati sozlanmagan');
    }

    const allowedSections = user.allowedSections ?? [];

    if (!allowedSections.includes(requiredSection)) {
      throw new ForbiddenException(
        'Sizda ushbu bo‘limga kirish uchun ruxsat yo‘q',
      );
    }

    return true;
  }
}
