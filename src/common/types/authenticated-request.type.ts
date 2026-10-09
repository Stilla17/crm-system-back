import type { Request } from 'express';
import { RoleScope } from '../../roles/enum/role-scope.enum.js';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    companyId: string | null;
    roleId: string;
    permissions: string[];
    roleName: string;
    roleScope: RoleScope
  };
}
