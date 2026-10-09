import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../types/authenticated-request.type.js';

export const CurrentCompanyId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const companyId = req.user.companyId;

    if (!companyId) {
      throw new ForbiddenException('Bu amal uchun kompaniya tanlanmagan');
    }

    return companyId;
  },
);
