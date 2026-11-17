export type MoyskladSalesEntity =
  'demand' | 'retaildemand' | 'salesreturn' | 'retailsalesreturn';

export interface MoyskladDocument {
  id: string;
  name: string;
  moment: string;
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
}

export interface MoyskladRetailStore {
  id: string;
  name: string;
  archived: boolean;
  externalCode: string;
  organization: MoyskladOrganization;
}
