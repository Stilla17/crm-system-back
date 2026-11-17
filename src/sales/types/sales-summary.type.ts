export interface SalesChannelSummary {
  sales: number;
  returns: number;
  netSales: number;
  salesDocumentCount: number;
  returnDocumentCount: number;
}

export interface SalesSummaryResponse {
  period: {
    from: string;
    to: string;
    timezone: 'Asia/Tashkent';
  };
  summary: {
    grossSales: number;
    returns: number;
    netSales: number;
    salesDocumentCount: number;
    returnDocumentCount: number;
  };
  breakdown: {
    wholesale: SalesChannelSummary;
    retail: SalesChannelSummary;
  };
  currency: {
    code: 'UZS';
    precision: 2;
  };
  source: 'moysklad';
}
