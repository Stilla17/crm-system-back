import { IsNumber, Matches, Min } from 'class-validator';

export class UpsertBranchPlanDto {
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'month YYYY-MM formatida bo‘lishi kerak',
  })
  month: string;

  @IsNumber()
  @Min(0)
  amount: number;
}
