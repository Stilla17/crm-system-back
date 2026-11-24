export type MoyskladSalesEntity =
  'demand' | 'retaildemand' | 'salesreturn' | 'retailsalesreturn';

export interface MoyskladDocument {
  id: string;
  name: string;
  moment: string;
  updated?: string;
  applicable: boolean;
  sum: number;

  retailStore?: {
    meta: {
      href: string;
    };
  };
}

export interface MoyskladListMeta {
  href: string;
  size: number;
  limit: number;
  offset: number;
}

export interface MoyskladListResponse<T> {
  meta: MoyskladListMeta;
  rows: T[];
}

export interface MoyskladDocumentSummary {
  amount: number;
  count: number;
}

export interface MoyskladOrganization {
  id: string;
  name: string;
  archived: boolean;
}

export interface MoyskladRetailStore {
  id: string;
  name: string;
  archived: boolean;
  externalCode?: string;
  organization: MoyskladOrganization;

  store: {
    meta: {
      href: string;
    };
  };
}

export interface MoyskladSalesPlotSeriesItem {
  date: string;
  quantity: number;
  sum: number;
}

export interface MoyskladSalesPlotSeriesResponse {
  series: MoyskladSalesPlotSeriesItem[];
}

export interface MoyskladStockByStoreRow {
  meta: {
    href: string;
    type: string;
  };
  stockByStore: Array<{
    meta: {
      href: string;
    };
    name: string;
    stock: number;
    inTransit: number;
  }>;
}

export interface MoyskladAssortmentItem {
  id: string;
  name: string;
  code?: string;
  article?: string;
  archived: boolean;
  meta: {
    href: string;
    type: string;
  };
}

export interface MoyskladRetailStoreProduct {
  id: string;
  name: string;
  code?: string;
  article?: string;
  type: string;
  stock: number;
  available: number;
  inTransit: number;
}

export type MoyskladProductSalesEntity = 'demand' | 'retaildemand';

export interface MoyskladProductSale {
  productId: string;
  moment: string;
  quantity: number;
}

export interface MoyskladProductReceipt {
  productId: string;
  moment: string;
}

export type MoyskladProductReceiptEntity = 'supply' | 'enter';

export interface MoyskladDocumentPosition {
  quantity: number;
  assortment: {
    meta: {
      href: string;
      type: string;
    };
  };
}

export interface MoyskladDocumentPositions {
  meta: {
    size: number;
    limit: number;
    offset: number;
  };
  rows: MoyskladDocumentPosition[];
}

export interface MoyskladSalesDocumentWithPositions {
  id: string;
  moment: string;
  positions: MoyskladDocumentPositions;
}

export interface MoyskladIncomingDocumentWithPositions {
  id: string;
  moment: string;
  store?: {
    meta: {
      href: string;
    };
  };
  targetStore?: {
    meta: {
      href: string;
    };
  };
  positions: MoyskladDocumentPositions;
}
