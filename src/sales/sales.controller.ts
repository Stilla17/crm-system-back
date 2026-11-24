import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { SalesSummaryQueryDto } from './dto/sales-summary-query.dto.js';
import { SalesService } from './sales.service.js';
import { UpsertBranchPlanDto } from './dto/upsert-branch-plan.dto.js';
import { BranchProductsQueryDto } from './dto/branch-products-query.dto.js';
import { TransferRecommendationsQueryDto } from './dto/transfer-recommendations-query.dto.js';
import { AllTransferRecommendationsQueryDto } from './dto/all-transfer-recommendations-query.dto.js';

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

  @Get('transfer-recommendations')
  getTransferRecommendations(@Query() query: TransferRecommendationsQueryDto) {
    return this.salesService.getTransferRecommendations(query);
  }

  @Get('transfer-recommendations/all')
  getAllTransferRecommendations(
    @Query() query: AllTransferRecommendationsQueryDto,
  ) {
    return this.salesService.getAllTransferRecommendations(query);
  }

  @Get('branches/:branchId/products')
  getBranchProducts(
    @Param('branchId') branchId: string,
    @Query() query: BranchProductsQueryDto,
  ) {
    return this.salesService.getBranchProducts(branchId, query);
  }

  @Get('branches/:branchId/products/:productId/analysis')
  getProductBranchAnalysis(
    @Param('branchId') branchId: string,
    @Param('productId') productId: string,
  ) {
    return this.salesService.getProductBranchAnalysis(branchId, productId);
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
