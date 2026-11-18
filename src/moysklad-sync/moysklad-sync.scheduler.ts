import { Injectable, Logger } from '@nestjs/common';
import { Cron, Timeout } from '@nestjs/schedule';

import { MoyskladSyncService } from './moysklad-sync.service.js';

const TASHKENT_TIME_ZONE = 'Asia/Tashkent';
const ONE_DAY_MS = 86_400_000;

const dateFormatter = new Intl.DateTimeFormat('en', {
  timeZone: TASHKENT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function formatTashkentDate(date: Date): string {
  const parts = dateFormatter.formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Toshkent sanasini aniqlab bo‘lmadi');
  }

  return `${year}-${month}-${day}`;
}

@Injectable()
export class MoyskladSyncScheduler {
  private readonly logger = new Logger(MoyskladSyncScheduler.name);

  private syncQueue: Promise<void> = Promise.resolve();

  constructor(private readonly moyskladSyncService: MoyskladSyncService) {}

  @Timeout(5_000)
  syncAfterApplicationStart(): Promise<void> {
    return this.enqueueSync(
      formatTashkentDate(new Date()),
      'Server ishga tushgandagi sync',
    );
  }

  @Cron('0 */30 * * * *', {
    name: 'moysklad-sync-today',
    timeZone: TASHKENT_TIME_ZONE,
    waitForCompletion: true,
  })
  syncToday(): Promise<void> {
    return this.enqueueSync(
      formatTashkentDate(new Date()),
      'Bugungi avtomatik sync',
    );
  }

  @Cron('0 10 0 * * *', {
    name: 'moysklad-sync-yesterday',
    timeZone: TASHKENT_TIME_ZONE,
    waitForCompletion: true,
  })
  syncYesterday(): Promise<void> {
    const yesterday = new Date(Date.now() - ONE_DAY_MS);

    return this.enqueueSync(
      formatTashkentDate(yesterday),
      'Kechagi yakuniy sync',
    );
  }

  private enqueueSync(date: string, label: string): Promise<void> {
    const task = this.syncQueue.then(() => this.runSync(date, label));

    this.syncQueue = task.catch(() => undefined);

    return task;
  }

  private async runSync(date: string, label: string): Promise<void> {
    this.logger.log(`${label} boshlandi: ${date}`);

    try {
      const result = await this.moyskladSyncService.syncRange(date, date);

      this.logger.log(`${label} tugadi: ${JSON.stringify(result)}`);
    } catch (error) {
      const message = error instanceof Error ? error.stack : String(error);

      this.logger.error(`${label} xatosi`, message);
    }
  }
}
