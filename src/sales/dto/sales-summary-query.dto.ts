import { IsEnum, IsOptional, Matches } from 'class-validator';

export enum BranchSalesType {
  ALL = 'all',
  SHIPMENT = 'shipment',
  RETAIL = 'retail',
}

export class SalesSummaryQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from YYYY-MM-DD formatida bo‘lishi kerak',
  })
  from: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to YYYY-MM-DD formatida bo‘lishi kerak',
  })
  to: string;

  @IsOptional()
  @IsEnum(BranchSalesType, {
    message: 'type all, shipment yoki retail bo‘lishi kerak',
  })
  type?: BranchSalesType;
}
