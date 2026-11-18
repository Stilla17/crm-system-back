import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { SalesSummaryQueryDto } from './dto/sales-summary-query.dto.js';
import { SalesService } from './sales.service.js';
import { UpsertBranchPlanDto } from './dto/upsert-branch-plan.dto.js';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // @Get('summary')
  // @RequirePermissions(Permission.SALES_READ)
  // getSummary(@Query() query: SalesSummaryQueryDto) {
  //   return this.salesService.getSummary(query);
  // }

  @Get('summary')
  getSummary(@Query() query: SalesSummaryQueryDto) {
    return this.salesService.getSummary(query);
  }

  @Get('branch-summary')
  getBranchesSummary(@Query() query: SalesSummaryQueryDto) {
    return this.salesService.getBranchesSummary(query);
  }

  @Put('branch-plans/:retailStoreId')
  upsertBranchPlan(
    @Param('retailStoreId') retailStoreId: string,
    @Body() dto: UpsertBranchPlanDto,
  ) {
    return this.salesService.upsertBranchPlan(
      retailStoreId,
      dto.month,
      dto.amount,
    );
  }
}
