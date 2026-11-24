import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MoyskladAssortmentItem,
  MoyskladDocument,
  MoyskladDocumentPosition,
  MoyskladDocumentPositions,
  MoyskladDocumentSummary,
  MoyskladListResponse,
  MoyskladOrganization,
  MoyskladIncomingDocumentWithPositions,
  MoyskladProductReceipt,
  MoyskladProductReceiptEntity,
  MoyskladProductSale,
  MoyskladProductSalesEntity,
  MoyskladRetailStore,
  MoyskladRetailStoreProduct,
  MoyskladSalesEntity,
  MoyskladSalesPlotSeriesItem,
  MoyskladSalesPlotSeriesResponse,
  MoyskladSalesDocumentWithPositions,
  MoyskladStockByStoreRow,
} from './types/moysklad-document.type.js';

const PAGE_LIMIT = 1000;
const RETAIL_STORES_PAGE_LIMIT = 100;
const MAX_PAGES = 1000;
const MAX_RETRIES = 5;
const MAX_RETRY_DELAY_MS = 60_000;
const RETAIL_STORES_CACHE_MS = 60 * 60_000;
const ASSORTMENT_CACHE_MS = 60 * 60_000;
const MOVE_RECEIPTS_CACHE_MS = 60 * 60_000;
const EXPANDED_DOCUMENT_PAGE_LIMIT = 100;

@Injectable()
export class MoyskladClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private retailStoresCache?: {
    data: MoyskladRetailStore[];
    expiresAt: number;
  };
  private organizationsCache?: {
    data: MoyskladOrganization[];
    expiresAt: number;
  };
  private assortmentCache?: {
    data: MoyskladAssortmentItem[];
    expiresAt: number;
  };
  private moveReceiptsCache?: {
    data: Map<string, MoyskladProductReceipt[]>;
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
      response.headers.get('X-Lognex-Reset') ??
      response.headers.get('X-Lognex-Retry-TimeInterval');

    const parsedValue = Number(headerValue);

    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      return Math.min(parsedValue, MAX_RETRY_DELAY_MS);
    }

    return 1000 * (attempt + 1);
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  async getRetailStoreStockReport(
    retailStoreId: string,
  ): Promise<MoyskladStockByStoreRow[]> {
    const retailStore = (await this.listAllRetailStores()).find(
      (store) => store.id === retailStoreId,
    );

    if (!retailStore?.store?.meta.href) {
      throw new BadGatewayException(
        `Moysklad filial ombori topilmadi: ${retailStoreId}`,
      );
    }

    const rows: MoyskladStockByStoreRow[] = [];
    let offset = 0;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await this.request<
        MoyskladListResponse<MoyskladStockByStoreRow>
      >('/report/stock/bystore', {
        limit: String(PAGE_LIMIT),
        offset: String(offset),
        filter: `store=${retailStore.store.meta.href}`,
      });

      if (!response || !Array.isArray(response.rows)) {
        throw new BadGatewayException(
          "Moysklad ombor qoldig'i hisobotini noto'g'ri formatda qaytardi",
        );
      }
      rows.push(...response.rows);

      if (response.rows.length === 0 || rows.length >= response.meta.size) {
        return rows;
      }

      offset += response.rows.length;
    }
    throw new BadGatewayException(
      'MoySklad pagination chegarasidan oshib ketdi',
    );
  }

  async listAllAssortment(): Promise<MoyskladAssortmentItem[]> {
    if (this.assortmentCache && this.assortmentCache.expiresAt > Date.now()) {
      return this.assortmentCache.data;
    }

    const assortment: MoyskladAssortmentItem[] = [];
    let offset = 0;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await this.request<
        MoyskladListResponse<MoyskladAssortmentItem>
      >('/entity/assortment', {
        limit: String(PAGE_LIMIT),
        offset: String(offset),
      });

      if (!response || !Array.isArray(response.rows)) {
        throw new BadGatewayException(
          'MoySklad assortiment ro‘yxatini noto‘g‘ri formatda qaytardi',
        );
      }

      assortment.push(...response.rows);

      if (
        response.rows.length === 0 ||
        assortment.length >= response.meta.size
      ) {
        const activeAssortment = assortment.filter((item) => !item.archived);

        this.assortmentCache = {
          data: activeAssortment,
          expiresAt: Date.now() + ASSORTMENT_CACHE_MS,
        };

        return activeAssortment;
      }

      offset += response.rows.length;
    }

    throw new BadGatewayException(
      'MoySklad assortiment pagination chegarasidan oshib ketdi',
    );
  }

  async getRetailStoreProducts(
    retailStoreId: string,
  ): Promise<MoyskladRetailStoreProduct[]> {
    const [stockRows, assortment] = await Promise.all([
      this.getRetailStoreStockReport(retailStoreId),
      this.listAllAssortment(),
    ]);

    const assortmentById = new Map(assortment.map((item) => [item.id, item]));

    return stockRows.map((row) => {
      const productId = this.getEntityIdFromHref(row.meta.href);
      const product = assortmentById.get(productId);
      const totals = row.stockByStore.reduce(
        (result, stock) => ({
          stock: result.stock + stock.stock,
          inTransit: result.inTransit + stock.inTransit,
        }),
        {
          stock: 0,
          inTransit: 0,
        },
      );

      return {
        id: productId,
        name: product?.name ?? productId,
        code: product?.code,
        article: product?.article,
        type: product?.meta.type ?? row.meta.type,
        stock: totals.stock,
        available: totals.stock,
        inTransit: totals.inTransit,
      };
    });
  }

  async getProductSalesByStore(
    storeHref: string,
    from: string,
    to: string,
  ): Promise<MoyskladProductSale[]> {
    const [shipmentSales, retailSales] = await Promise.all([
      this.listProductSalesDocuments('demand', storeHref, from, to),
      this.listProductSalesDocuments('retaildemand', storeHref, from, to),
    ]);

    return [...shipmentSales, ...retailSales];
  }

  async getProductReceiptsByStore(
    storeHref: string,
  ): Promise<MoyskladProductReceipt[]> {
    const [supplies, enters, movesByTargetStore] = await Promise.all([
      this.listProductReceiptDocuments('supply', storeHref),
      this.listProductReceiptDocuments('enter', storeHref),
      this.listAllMoveReceiptsByTargetStore(),
    ]);

    return [
      ...supplies,
      ...enters,
      ...(movesByTargetStore.get(storeHref) ?? []),
    ];
  }

  private async listProductReceiptDocuments(
    entity: MoyskladProductReceiptEntity,
    storeHref: string,
  ): Promise<MoyskladProductReceipt[]> {
    const receipts: MoyskladProductReceipt[] = [];
    let offset = 0;
    const filter = ['applicable=true', `store=${storeHref}`].join(';');

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await this.request<
        MoyskladListResponse<MoyskladIncomingDocumentWithPositions>
      >(`/entity/${entity}`, {
        limit: String(EXPANDED_DOCUMENT_PAGE_LIMIT),
        offset: String(offset),
        expand: 'positions',
        filter,
      });

      if (!response || !Array.isArray(response.rows)) {
        throw new BadGatewayException(
          `MoySklad ${entity} kirim hujjatlarini noto'g'ri formatda qaytardi`,
        );
      }

      await this.collectProductReceipts(entity, response.rows, receipts);

      if (
        response.rows.length === 0 ||
        offset + response.rows.length >= response.meta.size
      ) {
        return receipts;
      }

      offset += response.rows.length;
    }

    throw new BadGatewayException(
      `MoySklad ${entity} kirim pagination chegarasidan oshib ketdi`,
    );
  }

  private async listAllMoveReceiptsByTargetStore(): Promise<
    Map<string, MoyskladProductReceipt[]>
  > {
    if (
      this.moveReceiptsCache &&
      this.moveReceiptsCache.expiresAt > Date.now()
    ) {
      return this.moveReceiptsCache.data;
    }

    const receiptsByTargetStore = new Map<string, MoyskladProductReceipt[]>();
    const getPage = (offset: number) =>
      this.request<MoyskladListResponse<MoyskladIncomingDocumentWithPositions>>(
        '/entity/move',
        {
          limit: String(EXPANDED_DOCUMENT_PAGE_LIMIT),
          offset: String(offset),
          expand: 'positions',
          filter: 'applicable=true',
        },
      );
    const firstPage = await getPage(0);

    if (!firstPage || !Array.isArray(firstPage.rows)) {
      throw new BadGatewayException(
        "MoySklad ko'chirish hujjatlarini noto'g'ri formatda qaytardi",
      );
    }

    const totalPages = Math.ceil(
      firstPage.meta.size / EXPANDED_DOCUMENT_PAGE_LIMIT,
    );

    if (totalPages > MAX_PAGES) {
      throw new BadGatewayException(
        "MoySklad ko'chirish pagination chegarasidan oshib ketdi",
      );
    }

    await this.collectMoveReceipts(firstPage.rows, receiptsByTargetStore);

    const offsets = Array.from(
      { length: Math.max(totalPages - 1, 0) },
      (_, index) => (index + 1) * EXPANDED_DOCUMENT_PAGE_LIMIT,
    );
    const concurrency = 3;

    for (let index = 0; index < offsets.length; index += concurrency) {
      const responses = await Promise.all(
        offsets.slice(index, index + concurrency).map(getPage),
      );

      for (const response of responses) {
        if (!response || !Array.isArray(response.rows)) {
          throw new BadGatewayException(
            "MoySklad ko'chirish hujjatlarini noto'g'ri formatda qaytardi",
          );
        }

        await this.collectMoveReceipts(response.rows, receiptsByTargetStore);
      }
    }

    this.moveReceiptsCache = {
      data: receiptsByTargetStore,
      expiresAt: Date.now() + MOVE_RECEIPTS_CACHE_MS,
    };

    return receiptsByTargetStore;
  }

  private async collectMoveReceipts(
    documents: MoyskladIncomingDocumentWithPositions[],
    receiptsByTargetStore: Map<string, MoyskladProductReceipt[]>,
  ): Promise<void> {
    for (const document of documents) {
      const targetStoreHref = document.targetStore?.meta.href;

      if (!targetStoreHref) continue;

      const receipts = receiptsByTargetStore.get(targetStoreHref) ?? [];
      await this.collectProductReceipts('move', [document], receipts);
      receiptsByTargetStore.set(targetStoreHref, receipts);
    }
  }

  private async collectProductReceipts(
    entity: MoyskladProductReceiptEntity | 'move',
    documents: MoyskladIncomingDocumentWithPositions[],
    receipts: MoyskladProductReceipt[],
  ): Promise<void> {
    for (const document of documents) {
      const positions = await this.listAllDocumentPositions(
        entity,
        document.id,
        document.positions,
      );

      for (const position of positions) {
        receipts.push({
          productId: this.getEntityIdFromHref(position.assortment.meta.href),
          moment: document.moment,
        });
      }
    }
  }

  private async listProductSalesDocuments(
    entity: MoyskladProductSalesEntity,
    storeHref: string,
    from: string,
    to: string,
  ): Promise<MoyskladProductSale[]> {
    const sales: MoyskladProductSale[] = [];
    let offset = 0;

    const filter = [
      `moment>=${from} 00:00:00`,
      `moment<=${to} 23:59:59`,
      'applicable=true',
      `store=${storeHref}`,
    ].join(';');

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await this.request<
        MoyskladListResponse<MoyskladSalesDocumentWithPositions>
      >(`/entity/${entity}`, {
        limit: String(EXPANDED_DOCUMENT_PAGE_LIMIT),
        offset: String(offset),
        expand: 'positions',
        filter,
      });

      if (!response || !Array.isArray(response.rows)) {
        throw new BadGatewayException(
          'MoySklad mahsulot sotuvlarini noto‘g‘ri formatda qaytardi',
        );
      }

      for (const document of response.rows) {
        const positions = await this.listAllDocumentPositions(
          entity,
          document.id,
          document.positions,
        );

        for (const position of positions) {
          sales.push({
            productId: this.getEntityIdFromHref(position.assortment.meta.href),
            moment: document.moment,
            quantity: position.quantity,
          });
        }
      }

      if (
        response.rows.length === 0 ||
        offset + response.rows.length >= response.meta.size
      ) {
        return sales;
      }

      offset += response.rows.length;
    }

    throw new BadGatewayException(
      'MoySklad mahsulot sotuvlari pagination chegarasidan oshib ketdi',
    );
  }

  private async listAllDocumentPositions(
    entity: MoyskladProductSalesEntity | MoyskladProductReceiptEntity | 'move',
    documentId: string,
    expandedPositions: MoyskladDocumentPositions,
  ): Promise<MoyskladDocumentPosition[]> {
    if (expandedPositions.meta.size <= expandedPositions.rows.length) {
      return expandedPositions.rows;
    }

    const positions = [...expandedPositions.rows];
    let offset = positions.length;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await this.request<
        MoyskladListResponse<MoyskladDocumentPosition>
      >(`/entity/${entity}/${documentId}/positions`, {
        limit: String(PAGE_LIMIT),
        offset: String(offset),
      });

      if (!response || !Array.isArray(response.rows)) {
        throw new BadGatewayException(
          `MoySklad ${entity} hujjati pozitsiyalarini noto'g'ri formatda qaytardi`,
        );
      }

      positions.push(...response.rows);

      if (
        response.rows.length === 0 ||
        positions.length >= response.meta.size
      ) {
        return positions;
      }

      offset += response.rows.length;
    }

    throw new BadGatewayException(
      `MoySklad ${entity} hujjati pozitsiyalari pagination chegarasidan oshdi`,
    );
  }

  private getEntityIdFromHref(href: string): string {
    const normalizedHref = href.split('?', 1)[0].replace(/\/+$/, '');
    const entityId = normalizedHref.split('/').pop();

    if (!entityId) {
      throw new BadGatewayException(
        'MoySklad entity ID manzilidan aniqlanmadi',
      );
    }

    return entityId;
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
        limit: String(RETAIL_STORES_PAGE_LIMIT),
        offset: String(offset),
        expand: 'organization',
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

  async listAllOrganizations(): Promise<MoyskladOrganization[]> {
    if (
      this.organizationsCache &&
      this.organizationsCache.expiresAt > Date.now()
    ) {
      return this.organizationsCache.data;
    }

    const organizations: MoyskladOrganization[] = [];
    let offset = 0;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const response = await this.request<
        MoyskladListResponse<MoyskladOrganization>
      >('/entity/organization', {
        limit: String(PAGE_LIMIT),
        offset: String(offset),
      });

      if (!response || !Array.isArray(response.rows)) {
        throw new BadGatewayException(
          'MoySklad tashkilotlar ro\u2018yxatini noto\u2018g\u2018ri formatda qaytardi',
        );
      }

      organizations.push(...response.rows);

      if (
        response.rows.length === 0 ||
        organizations.length >= response.meta.size
      ) {
        const activeOrganizations = organizations.filter(
          (organization) => !organization.archived,
        );

        this.organizationsCache = {
          data: activeOrganizations,
          expiresAt: Date.now() + RETAIL_STORES_CACHE_MS,
        };

        return activeOrganizations;
      }

      offset += response.rows.length;
    }

    throw new BadGatewayException(
      'MoySklad tashkilotlari pagination chegarasidan oshib ketdi',
    );
  }
}
