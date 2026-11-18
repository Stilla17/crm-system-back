import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MoyskladDocument,
  MoyskladDocumentSummary,
  MoyskladListResponse,
  MoyskladRetailStore,
  MoyskladSalesEntity,
  MoyskladSalesPlotSeriesItem,
  MoyskladSalesPlotSeriesResponse,
} from './types/moysklad-document.type.js';

const PAGE_LIMIT = 1000;
const MAX_PAGES = 1000;
const MAX_RETRIES = 2;
const RETAIL_STORES_CACHE_MS = 60 * 60_000;

@Injectable()
export class MoyskladClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private retailStoresCache?: {
    data: MoyskladRetailStore[];
    expiresAt: number;
  };

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService
      .getOrThrow<string>('MOYSKLAD_BASE_URL')
      .replace(/\/+$/, '');

    this.token = this.configService.getOrThrow<string>('MOYSKLAD_TOKEN');
  }

  // barcha savdolar, ya’ni Все
  async getSalesPlotSeriesByStore(
    storeHref: string,
    from: string,
    to: string,
  ): Promise<MoyskladSalesPlotSeriesItem[]> {
    const response = await this.request<MoyskladSalesPlotSeriesResponse>(
      '/report/sales/plotseries',
      {
        momentFrom: `${from} 00:00:00`,
        momentTo: `${to} 23:59:59`,
        interval: 'day',
        filter: `store=${storeHref}`,
      },
    );

    if (!response || !Array.isArray(response.series)) {
      throw new BadGatewayException(
        'MoySklad tayyor savdo hisobotini noto‘g‘ri formatda qaytardi',
      );
    }

    return response.series;
  }

  // chakana savdo, ya’ni Продажа
  async getSalesPlotSeriesByRetailStore(
    retailStoreId: string,
    from: string,
    to: string,
  ): Promise<MoyskladSalesPlotSeriesItem[]> {
    const retailStoreHref = `${this.baseUrl}/entity/retailstore/${retailStoreId}`;

    const response = await this.request<MoyskladSalesPlotSeriesResponse>(
      '/report/sales/plotseries',
      {
        momentFrom: `${from} 00:00:00`,
        momentTo: `${to} 23:59:59`,
        interval: 'day',
        filter: `retailStore=${retailStoreHref}`,
      },
    );

    if (!response || !Array.isArray(response.series)) {
      throw new BadGatewayException(
        'MoySklad chakana savdo hisobotini noto‘g‘ri formatda qaytardi',
      );
    }

    return response.series;
  }

  async listAllDocuments(
    entity: MoyskladSalesEntity,
    from: string,
    to: string,
  ): Promise<MoyskladDocument[]> {
    const filter = [
      `moment>=${from} 00:00:00`,
      `moment<=${to} 23:59:59`,
      'applicable=true',
    ].join(';');

    const firstPage = await this.request<
      MoyskladListResponse<MoyskladDocument>
    >(`/entity/${entity}`, {
      limit: String(PAGE_LIMIT),
      offset: '0',
      filter,
    });

    if (!firstPage || !Array.isArray(firstPage.rows)) {
      throw new BadGatewayException(
        'MoySklad hujjatlar ro‘yxatini noto‘g‘ri formatda qaytardi',
      );
    }

    const totalPages = Math.ceil(firstPage.meta.size / PAGE_LIMIT);

    if (totalPages > MAX_PAGES) {
      throw new BadGatewayException(
        'MoySklad pagination chegarasidan oshib ketdi',
      );
    }

    const documents = [...firstPage.rows];

    const offsets = Array.from(
      { length: Math.max(totalPages - 1, 0) },
      (_, index) => (index + 1) * PAGE_LIMIT,
    );

    const concurrency = 3;

    for (let index = 0; index < offsets.length; index += concurrency) {
      const currentOffsets = offsets.slice(index, index + concurrency);

      const responses = await Promise.all(
        currentOffsets.map((offset) =>
          this.request<MoyskladListResponse<MoyskladDocument>>(
            `/entity/${entity}`,
            {
              limit: String(PAGE_LIMIT),
              offset: String(offset),
              filter,
            },
          ),
        ),
      );

      for (const response of responses) {
        if (!response || !Array.isArray(response.rows)) {
          throw new BadGatewayException(
            'MoySklad hujjatlar sahifasini noto‘g‘ri formatda qaytardi',
          );
        }
        documents.push(...response.rows);
      }
    }
    return documents;
  }

  async summarizeDocuments(
    entity: MoyskladSalesEntity,
    from: string,
    to: string,
  ): Promise<MoyskladDocumentSummary> {
    let minorAmount = 0;
    let documentCount = 0;
    let offset = 0;

    const filter = [
      'moment>=' + from + ' 00:00:00',
      'moment<=' + to + ' 23:59:59',
      'applicable=true',
    ].join(';');

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await this.request<
        MoyskladListResponse<MoyskladDocument>
      >('/entity/' + entity, {
        limit: String(PAGE_LIMIT),
        offset: String(offset),
        filter,
      });

      if (!response || !Array.isArray(response.rows)) {
        throw new BadGatewayException(
          'MoySklad hujjatlar ro‘yxatini noto‘g‘ri formatda qaytardi',
        );
      }

      for (const document of response.rows) {
        minorAmount += document.sum;
      }

      documentCount += response.rows.length;

      if (response.rows.length === 0 || documentCount >= response.meta.size) {
        return {
          amount: Number((minorAmount / 100).toFixed(2)),
          count: documentCount,
        };
      }

      offset += response.rows.length;
    }

    throw new BadGatewayException(
      'MoySklad pagination chegarasidan oshib ketdi',
    );
  }

  private async request<T>(
    path: string,
    query: Record<string, string>,
    attempt = 0,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json;charset=utf-8',
          'Accept-Encoding': 'gzip',
        },
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      if (attempt < MAX_RETRIES) {
        await this.delay(500 * (attempt + 1));
        return this.request<T>(path, query, attempt + 1);
      }

      throw new ServiceUnavailableException(
        'MoySklad serveriga ulanib bo‘lmadi',
      );
    }

    if (response.status === 429 && attempt < MAX_RETRIES) {
      await this.delay(this.getRetryDelay(response, attempt));
      return this.request<T>(path, query, attempt + 1);
    }

    if ([502, 503, 504].includes(response.status) && attempt < MAX_RETRIES) {
      await this.delay(500 * (attempt + 1));
      return this.request<T>(path, query, attempt + 1);
    }

    const responseText = await response.text();

    if (!response.ok) {
      throw new BadGatewayException({
        message: 'MoySklad API xatosi',
        upstreamStatus: response.status,
      });
    }

    try {
      return JSON.parse(responseText) as T;
    } catch {
      throw new BadGatewayException('MoySklad JSON javobini o‘qib bo‘lmadi');
    }
  }

  private getRetryDelay(response: Response, attempt: number): number {
    const headerValue =
      response.headers.get('X-Lognex-Retry-After') ??
      response.headers.get('X-Lognex-Retry-TimeInterval');

    const parsedValue = Number(headerValue);

    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      return Math.min(parsedValue, 5000);
    }

    return 1000 * (attempt + 1);
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  async listAllRetailStores(): Promise<MoyskladRetailStore[]> {
    if (
      this.retailStoresCache &&
      this.retailStoresCache.expiresAt > Date.now()
    ) {
      return this.retailStoresCache.data;
    }

    const stores: MoyskladRetailStore[] = [];
    let offset = 0;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await this.request<
        MoyskladListResponse<MoyskladRetailStore>
      >('/entity/retailstore', {
        limit: String(PAGE_LIMIT),
        offset: String(offset),
      });

      if (!response || !Array.isArray(response.rows)) {
        throw new BadGatewayException(
          'MoySklad filiallar ro‘yxatini noto‘g‘ri formatda qaytardi',
        );
      }

      stores.push(...response.rows);

      if (response.rows.length === 0 || stores.length >= response.meta.size) {
        const activeStores = stores.filter((store) => !store.archived);

        this.retailStoresCache = {
          data: activeStores,
          expiresAt: Date.now() + RETAIL_STORES_CACHE_MS,
        };

        return activeStores;
      }

      offset += response.rows.length;
    }
    throw new BadGatewayException(
      'MoySklad filiallari pagination chegarasidan oshib ketdi',
    );
  }
}
