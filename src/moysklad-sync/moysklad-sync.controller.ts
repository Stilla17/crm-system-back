import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { SyncRangeDto } from './dto/sync-range.dto.js';
import { MoyskladSyncService } from './moysklad-sync.service.js';
import { SyncProductsDto } from './dto/sync-products.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('moysklad-sync')
export class MoyskladSyncController {
  constructor(private readonly moyskladSyncService: MoyskladSyncService) {}

  @Post('range')
  syncRange(@Body() dto: SyncRangeDto) {
    return this.moyskladSyncService.syncRange(dto.from, dto.to);
  }

  @Post('products')
  syncProducts(@Body() dto: SyncProductsDto) {
    return this.moyskladSyncService.syncBranchProducts(
      dto.retailStoreId,
      dto.limit,
    );
  }
}
