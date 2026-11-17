import { IsDateString, Matches } from 'class-validator';

export class EmployeeSalaryQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from YYYY-MM-DD formatida bo\u2018lishi kerak',
  })
  @IsDateString({ strict: true })
  from!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to YYYY-MM-DD formatida bo\u2018lishi kerak',
  })
  @IsDateString({ strict: true })
  to!: string;
}
