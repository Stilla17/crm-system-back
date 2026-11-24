import { MoyskladSyncService } from './moysklad-sync.service.js';

describe('MoyskladSyncService', () => {
  it('should be defined', () => {
    const service = new MoyskladSyncService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    expect(service).toBeDefined();
  });

  it('calculates sales even when product sync has a limit', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T07:00:00.000Z'));

    const retailStoreId = 'c580cb05-698e-11f1-0a80-17250013f8cd';
    const storeHref =
      'https://api.moysklad.ru/api/remap/1.2/entity/store/a0541343-5dbc-11f1-0a80-19be00363869';
    const productId = '33117743-adc0-11ec-0a80-05b6004c2e23';
    const getProductSalesByStore = vi.fn().mockResolvedValue([
      {
        productId,
        moment: '2026-11-09 14:22:00.000',
        quantity: 4,
      },
      {
        productId,
        moment: '2026-10-10 16:21:00.000',
        quantity: 1,
      },
    ]);
    const bulkWrite = vi.fn().mockResolvedValue({});
    const moyskladClient = {
      listAllRetailStores: vi.fn().mockResolvedValue([
        {
          id: retailStoreId,
          name: 'Qarshi 2- filial',
          archived: false,
          organization: { id: 'organization-id', name: 'Qashqadaryo' },
          store: { meta: { href: storeHref } },
        },
      ]),
      getRetailStoreProducts: vi.fn().mockResolvedValue([
        {
          id: productId,
          name: 'Румий: Хикматлар (юмшоқ)',
          code: '8324',
          article: '2174',
          type: 'product',
          stock: 84,
          available: 84,
          inTransit: 0,
        },
      ]),
      getProductSalesByStore,
      getProductReceiptsByStore: vi.fn().mockResolvedValue([
        {
          productId,
          moment: '2026-08-14 10:38:00.000',
        },
      ]),
    };
    const retailStoreModel = {
      updateMany: vi
        .fn()
        .mockReturnValue({ exec: vi.fn().mockResolvedValue({}) }),
      bulkWrite: vi.fn().mockResolvedValue({}),
    };
    const branchProductStatModel = { bulkWrite };
    const service = new MoyskladSyncService(
      moyskladClient as never,
      {} as never,
      retailStoreModel as never,
      branchProductStatModel as never,
    );

    await service.syncBranchProducts(retailStoreId, 1);

    expect(getProductSalesByStore).toHaveBeenCalledOnce();
    expect(getProductSalesByStore).toHaveBeenCalledWith(
      storeHref,
      expect.any(String),
      expect.any(String),
    );
    const operations = bulkWrite.mock.calls[0]?.[0];
    const values = operations[0].updateOne.update.$set;

    expect(values.soldQuantity30Days).toBe(4);
    expect(values.soldQuantity90Days).toBe(5);
    expect(values.lastSoldAt).toEqual(new Date('2026-11-09T09:22:00.000Z'));
    expect(values.lastReceivedAt).toEqual(new Date('2026-08-14T05:38:00.000Z'));

    vi.useRealTimers();
  });

  it('runs the automatic product sync only after three days', async () => {
    const exec = vi.fn().mockResolvedValue({
      syncedAt: new Date('2026-11-20T22:30:00.000Z'),
    });
    const branchProductStatModel = {
      findOne: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            lean: vi.fn().mockReturnValue({ exec }),
          }),
        }),
      }),
    };
    const service = new MoyskladSyncService(
      {} as never,
      {} as never,
      {} as never,
      branchProductStatModel as never,
    );

    await expect(
      service.isBranchProductSyncDue(new Date('2026-11-22T22:00:00.000Z')),
    ).resolves.toBe(false);
    await expect(
      service.isBranchProductSyncDue(new Date('2026-11-23T22:00:00.000Z')),
    ).resolves.toBe(true);
  });
});
