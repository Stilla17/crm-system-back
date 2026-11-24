import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

const MOYSKLAD_ID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export class TransferRecommendationsQueryDto {
  @Matches(MOYSKLAD_ID_PATTERN, {
    message: 'sourceBranchId noto‘g‘ri formatda',
  })
  sourceBranchId: string;

  @Matches(MOYSKLAD_ID_PATTERN, {
    message: 'targetBranchId noto‘g‘ri formatda',
  })
  targetBranchId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  minTargetSales30Days = 5;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1.1)
  @Max(20)
  minVelocityRatio = 2;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(90)
  targetCoverDays = 30;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(90)
  sourceSafetyDays = 30;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxTransferQuantity = 100;
}
