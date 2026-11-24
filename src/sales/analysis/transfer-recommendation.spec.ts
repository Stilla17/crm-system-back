import {
  buildAllBranchTransferRecommendations,
  buildProductBranchAnalysis,
  buildTransferRecommendations,
} from './transfer-recommendation.js';

describe('buildProductBranchAnalysis', () => {
  it('ranks branches by weighted sales velocity and identifies the strongest branch', () => {
    const syncedAt = new Date('2026-11-24T10:00:00.000Z');
    const analysis = buildProductBranchAnalysis(
      [
        {
          retailStoreId: 'qarshi',
          productId: 'product-1',
          productName: 'Test kitob',
          available: 40,
          reserve: 0,
          inTransit: 0,
          soldQuantity30Days: 2,
          soldQuantity90Days: 6,
          syncedAt,
        },
        {
          retailStoreId: 'navoiy',
          productId: 'product-1',
          productName: 'Test kitob',
          available: 3,
          reserve: 0,
          inTransit: 0,
          soldQuantity30Days: 20,
          soldQuantity90Days: 45,
          syncedAt,
        },
      ],
      'qarshi',
    );

    expect(analysis).toMatchObject({
      currentBranchRank: 2,
      bestSellingBranchId: 'navoiy',
      velocityRatio: 9.25,
    });
    expect(analysis.branches[0]).toMatchObject({
      branchId: 'navoiy',
      rank: 1,
      dailyVelocity: 0.617,
      isCurrentBranch: false,
    });
  });

  it('does not claim a best-selling branch when no branch has sales', () => {
    const syncedAt = new Date('2026-11-24T10:00:00.000Z');
    const analysis = buildProductBranchAnalysis(
      [
        {
          retailStoreId: 'qarshi',
          productId: 'product-1',
          productName: 'Test kitob',
          available: 0,
          reserve: 0,
          inTransit: 0,
          soldQuantity30Days: 0,
          soldQuantity90Days: 0,
          syncedAt,
        },
      ],
      'qarshi',
    );

    expect(analysis.bestSellingBranchId).toBeNull();
    expect(analysis.velocityRatio).toBeNull();
  });
});

describe('buildTransferRecommendations', () => {
  it('recommends moving excess stock to a faster-selling branch', () => {
    const syncedAt = new Date('2026-11-24T10:00:00.000Z');
    const recommendations = buildTransferRecommendations(
      [
        {
          productId: 'product-1',
          productName: 'Test kitob',
          available: 40,
          reserve: 0,
          inTransit: 0,
          soldQuantity30Days: 2,
          soldQuantity90Days: 6,
          syncedAt,
        },
      ],
      [
        {
          productId: 'product-1',
          productName: 'Test kitob',
          available: 3,
          reserve: 0,
          inTransit: 0,
          soldQuantity30Days: 20,
          soldQuantity90Days: 45,
          syncedAt,
        },
      ],
      {
        minTargetSales30Days: 5,
        minVelocityRatio: 2,
        targetCoverDays: 30,
        sourceSafetyDays: 30,
        maxTransferQuantity: 100,
      },
    );

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({
      productId: 'product-1',
      confidence: 'high',
      suggestedQuantity: 16,
    });
  });

  it('does not recommend a transfer when target stock is sufficient', () => {
    const syncedAt = new Date('2026-11-24T10:00:00.000Z');
    const recommendations = buildTransferRecommendations(
      [
        {
          productId: 'product-1',
          productName: 'Test kitob',
          available: 40,
          reserve: 0,
          inTransit: 0,
          soldQuantity30Days: 2,
          soldQuantity90Days: 6,
          syncedAt,
        },
      ],
      [
        {
          productId: 'product-1',
          productName: 'Test kitob',
          available: 50,
          reserve: 0,
          inTransit: 0,
          soldQuantity30Days: 20,
          soldQuantity90Days: 45,
          syncedAt,
        },
      ],
      {
        minTargetSales30Days: 5,
        minVelocityRatio: 2,
        targetCoverDays: 30,
        sourceSafetyDays: 30,
        maxTransferQuantity: 100,
      },
    );

    expect(recommendations).toEqual([]);
  });

  it('keeps the source branch safety stock and accounts for target stock in transit', () => {
    const syncedAt = new Date('2026-11-24T10:00:00.000Z');
    const recommendations = buildTransferRecommendations(
      [
        {
          productId: 'product-1',
          productName: 'Test kitob',
          available: 40,
          reserve: 0,
          inTransit: 0,
          soldQuantity30Days: 6,
          soldQuantity90Days: 18,
          syncedAt,
        },
      ],
      [
        {
          productId: 'product-1',
          productName: 'Test kitob',
          available: 3,
          reserve: 0,
          inTransit: 14,
          soldQuantity30Days: 20,
          soldQuantity90Days: 45,
          syncedAt,
        },
      ],
      {
        minTargetSales30Days: 5,
        minVelocityRatio: 2,
        targetCoverDays: 30,
        sourceSafetyDays: 30,
        maxTransferQuantity: 100,
      },
    );

    expect(recommendations[0]).toMatchObject({
      suggestedQuantity: 2,
      source: {
        safetyStock: 6,
        excessStock: 34,
      },
      target: {
        stockNeed: 2,
      },
    });
  });

  it('does not reduce the source branch below its safety stock', () => {
    const syncedAt = new Date('2026-11-24T10:00:00.000Z');
    const recommendations = buildTransferRecommendations(
      [
        {
          productId: 'product-1',
          productName: 'Test kitob',
          available: 5,
          reserve: 0,
          inTransit: 0,
          soldQuantity30Days: 6,
          soldQuantity90Days: 18,
          syncedAt,
        },
      ],
      [
        {
          productId: 'product-1',
          productName: 'Test kitob',
          available: 3,
          reserve: 0,
          inTransit: 0,
          soldQuantity30Days: 20,
          soldQuantity90Days: 45,
          syncedAt,
        },
      ],
      {
        minTargetSales30Days: 5,
        minVelocityRatio: 2,
        targetCoverDays: 30,
        sourceSafetyDays: 30,
        maxTransferQuantity: 100,
      },
    );

    expect(recommendations).toEqual([]);
  });

  it('returns only the best branch direction for each product', () => {
    const syncedAt = new Date('2026-11-24T10:00:00.000Z');
    const recommendations = buildAllBranchTransferRecommendations(
      [
        {
          retailStoreId: 'qarshi',
          productId: 'product-1',
          productName: 'Test kitob',
          available: 40,
          reserve: 0,
          inTransit: 0,
          soldQuantity30Days: 2,
          soldQuantity90Days: 6,
          syncedAt,
        },
        {
          retailStoreId: 'navoiy',
          productId: 'product-1',
          productName: 'Test kitob',
          available: 3,
          reserve: 0,
          inTransit: 0,
          soldQuantity30Days: 20,
          soldQuantity90Days: 45,
          syncedAt,
        },
        {
          retailStoreId: 'buxoro',
          productId: 'product-1',
          productName: 'Test kitob',
          available: 4,
          reserve: 0,
          inTransit: 0,
          soldQuantity30Days: 10,
          soldQuantity90Days: 25,
          syncedAt,
        },
      ],
      {
        minTargetSales30Days: 5,
        minVelocityRatio: 2,
        targetCoverDays: 30,
        sourceSafetyDays: 30,
        maxTransferQuantity: 100,
      },
    );

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({
      productId: 'product-1',
      sourceBranchId: 'qarshi',
      targetBranchId: 'navoiy',
    });
  });
});
