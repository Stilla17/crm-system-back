import { Matches } from 'class-validator';

export class SyncRangeDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from YYYY-MM-DD formatida bo‘lishi kerak',
  })
  from: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to YYYY-MM-DD formatida bo‘lishi kerak',
  })
  to: string;
}