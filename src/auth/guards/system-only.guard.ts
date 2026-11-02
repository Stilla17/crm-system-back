import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type.js';
import { RoleScope } from '../../roles/enum/role-scope.enum.js';

@Injectable()
export class SystemOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const user = request.user;

    const isSuperAdmin =
      user?.roleScope === RoleScope.SYSTEM &&
      user?.companyId === null;

    if (!isSuperAdmin) {
      throw new ForbiddenException(
        'Bu endpointdan faqat Super Admin foydalana oladi',
      );
    }

    return true;
  }
}