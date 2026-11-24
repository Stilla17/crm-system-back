import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum BranchProductSort {
  STOCK_DESC = 'stock_desc',
  STOCK_ASC = 'stock_asc',
  NAME_ASC = 'name_asc',
  SALES_DESC = 'sales_desc',
  LAST_SOLD_ASC = 'last_sold_asc',
}

export enum BranchProductFilter {
  ALL = 'all',
  STALE = 'stale',
  NEVER_SOLD = 'never_sold',
}

export class BranchProductsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(BranchProductSort)
  sort?: BranchProductSort;

  @IsOptional()
  @IsEnum(BranchProductFilter)
  filter?: BranchProductFilter;

  @IsOptional()
  @Type(() => Number)
  @IsIn([30, 60, 90])
  staleDays = 90;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
