import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { MoyskladClient } from './moysklad.client.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('moysklad')
export class MoyskladController {
  constructor(private readonly moyskladClient: MoyskladClient) {}

  @Get('branches')
  async getBranches() {
    const stores = await this.moyskladClient.listAllRetailStores();

    return stores
      .map((store) => ({
        id: store.id,
        name: store.name,
        archived: store.archived,
        organization: store.organization
          ? { id: store.organization.id, name: store.organization.name }
          : null,
      }))
      .sort((first, second) => first.name.localeCompare(second.name, 'uz'));
  }

  @Get('organizations')
  async getOrganizations() {
    const organizations = await this.moyskladClient.listAllOrganizations();

    return organizations
      .map((organization) => ({
        id: organization.id,
        name: organization.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'uz'));
  }
}
