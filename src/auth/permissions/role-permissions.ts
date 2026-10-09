import { Permission } from './permissions.enum.js';

export const SUPER_ADMIN_PERMISSIONS: Permission[] = Object.values(Permission);
export const SYSTEM_ONLY_PERMISSIONS: Permission[] = [
  Permission.COMPANIES_CREATE,
  Permission.COMPANIES_DELETE,
];

export const COMPANY_ADMIN_PERMISSIONS: Permission[] = [
  Permission.ROLES_READ,
  Permission.ROLES_CREATE,
  Permission.ROLES_UPDATE,

  Permission.USERS_READ,
  Permission.USERS_CREATE,
  Permission.USERS_UPDATE,
  Permission.USERS_DELETE,

  Permission.CUSTOMERS_READ,
  Permission.CUSTOMERS_CREATE,
  Permission.CUSTOMERS_UPDATE,
  Permission.CUSTOMERS_DELETE,

  Permission.BOOKS_READ,
  Permission.BOOKS_CREATE,
  Permission.BOOKS_UPDATE,
  Permission.BOOKS_DELETE,

  Permission.SHIPMENTS_READ,
  Permission.SHIPMENTS_CREATE,
  Permission.SHIPMENTS_UPDATE,
  Permission.SHIPMENTS_DELETE,

  Permission.PAYMENTS_READ,
  Permission.PAYMENTS_CREATE,
  Permission.PAYMENTS_UPDATE,
  Permission.PAYMENTS_DELETE,
];

export const MANAGER_PERMISSIONS: Permission[] = [
  Permission.CUSTOMERS_READ,
  Permission.CUSTOMERS_CREATE,
  Permission.CUSTOMERS_UPDATE,

  Permission.BOOKS_READ,

  Permission.SHIPMENTS_READ,
  Permission.SHIPMENTS_CREATE,
  Permission.SHIPMENTS_UPDATE,

  Permission.PAYMENTS_READ,
];
