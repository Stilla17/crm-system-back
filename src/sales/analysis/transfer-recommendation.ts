export type TransferProductStat = {
  productId: string;
  productName: string;
  code?: string;
  article?: string;
  available: number;
  reserve: number;
  inTransit: number;
  soldQuantity30Days: number;
  soldQuantity90Days: number;
  syncedAt: Date;
};

export type TransferRecommendationRules = {
  minTargetSales30Days: number;
  minVelocityRatio: number;
  targetCoverDays: number;
  sourceSafetyDays: number;
  maxTransferQuantity: number;
};

export type BranchTransferProductStat = TransferProductStat & {
  retailStoreId: string;
};

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

const getWeightedDailyVelocity = (stat: TransferProductStat) =>
  (stat.soldQuantity30Days / 30) * 0.7 + (stat.soldQuantity90Days / 90) * 0.3;

export function buildProductBranchAnalysis(
  stats: BranchTransferProductStat[],
  currentBranchId: string,
) {
  const rankedStats = stats
    .map((stat) => ({
      branchId: stat.retailStoreId,
      available: stat.available,
      inTransit: stat.inTransit,
      soldQuantity30Days: stat.soldQuantity30Days,
      soldQuantity90Days: stat.soldQuantity90Days,
      syncedAt: stat.syncedAt,
      weightedDailyVelocity: getWeightedDailyVelocity(stat),
    }))
    .sort(
      (left, right) =>
        right.weightedDailyVelocity - left.weightedDailyVelocity ||
        right.soldQuantity30Days - left.soldQuantity30Days ||
        right.soldQuantity90Days - left.soldQuantity90Days ||
        left.branchId.localeCompare(right.branchId),
    );
  const currentStat = rankedStats.find(
    (stat) => stat.branchId === currentBranchId,
  );
  const bestSellingStat =
    rankedStats[0]?.weightedDailyVelocity > 0 ? rankedStats[0] : undefined;
  const branches = rankedStats.map(
    ({ weightedDailyVelocity, ...branch }, index) => ({
      ...branch,
      dailyVelocity: round(weightedDailyVelocity, 3),
      rank: index + 1,
      isCurrentBranch: branch.branchId === currentBranchId,
    }),
  );

  return {
    branches,
    currentBranchRank: currentStat
      ? rankedStats.indexOf(currentStat) + 1
      : null,
    bestSellingBranchId: bestSellingStat?.branchId ?? null,
    velocityRatio:
      bestSellingStat && currentStat && currentStat.weightedDailyVelocity > 0
        ? round(
            bestSellingStat.weightedDailyVelocity /
              currentStat.weightedDailyVelocity,
          )
        : null,
  };
}

export function buildTransferRecommendations(
  sourceStats: TransferProductStat[],
  targetStats: TransferProductStat[],
  rules: TransferRecommendationRules,
) {
  const targetByProductId = new Map(
    targetStats.map((stat) => [stat.productId, stat]),
  );

  return sourceStats
    .flatMap((source) => {
      const target = targetByProductId.get(source.productId);

      if (!target || target.soldQuantity30Days < rules.minTargetSales30Days) {
        return [];
      }

      const sourceVelocity = getWeightedDailyVelocity(source);
      const targetVelocity = getWeightedDailyVelocity(target);
      const velocityRatio =
        sourceVelocity > 0 ? targetVelocity / sourceVelocity : Infinity;

      if (
        targetVelocity <= sourceVelocity ||
        velocityRatio < rules.minVelocityRatio
      ) {
        return [];
      }

      const sourceSafetyStock = Math.max(
        2,
        Math.ceil(sourceVelocity * rules.sourceSafetyDays),
      );
      const sourceExcess = Math.max(
        0,
        Math.floor(source.available - sourceSafetyStock),
      );
      const targetRequiredStock = Math.ceil(
        targetVelocity * rules.targetCoverDays,
      );
      const targetNeed = Math.max(
        0,
        targetRequiredStock - target.available - target.inTransit,
      );
      const suggestedQuantity = Math.min(
        sourceExcess,
        targetNeed,
        rules.maxTransferQuantity,
      );

      if (suggestedQuantity < 1) return [];

      const estimatedAdditional30DaySales = Math.min(
        suggestedQuantity,
        Math.max(0, Math.ceil((targetVelocity - sourceVelocity) * 30)),
      );
      const finiteVelocityRatio = Number.isFinite(velocityRatio)
        ? velocityRatio
        : 99;
      const confidence =
        finiteVelocityRatio >= 4 && target.soldQuantity30Days >= 10
          ? ('high' as const)
          : ('medium' as const);
      const score = Math.min(
        100,
        Math.round(
          Math.min(finiteVelocityRatio, 10) * 5 +
            Math.min(target.soldQuantity30Days, 30) * 1.5 +
            Math.min(suggestedQuantity, 20),
        ),
      );

      return [
        {
          productId: source.productId,
          productName: source.productName,
          code: source.code,
          article: source.article,
          source: {
            available: source.available,
            reserve: source.reserve,
            soldQuantity30Days: source.soldQuantity30Days,
            soldQuantity90Days: source.soldQuantity90Days,
            dailyVelocity: round(sourceVelocity, 3),
            safetyStock: sourceSafetyStock,
            excessStock: sourceExcess,
          },
          target: {
            available: target.available,
            reserve: target.reserve,
            inTransit: target.inTransit,
            soldQuantity30Days: target.soldQuantity30Days,
            soldQuantity90Days: target.soldQuantity90Days,
            dailyVelocity: round(targetVelocity, 3),
            requiredStock: targetRequiredStock,
            stockNeed: targetNeed,
          },
          velocityRatio: round(finiteVelocityRatio),
          suggestedQuantity,
          estimatedAdditional30DaySales,
          confidence,
          score,
          reason:
            `Qabul qiluvchi filialdagi sotuv tezligi ${round(finiteVelocityRatio)} baravar yuqori; ` +
            `manba filialda ${sourceExcess} ta ortiqcha qoldiq mavjud.`,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.suggestedQuantity - left.suggestedQuantity ||
        left.productName.localeCompare(right.productName),
    );
}

export function buildAllBranchTransferRecommendations(
  stats: BranchTransferProductStat[],
  rules: TransferRecommendationRules,
) {
  const statsByProductId = new Map<string, BranchTransferProductStat[]>();

  for (const stat of stats) {
    const productStats = statsByProductId.get(stat.productId) ?? [];
    productStats.push(stat);
    statsByProductId.set(stat.productId, productStats);
  }

  const recommendations = [];

  for (const productStats of statsByProductId.values()) {
    let bestRecommendation:
      | (ReturnType<typeof buildTransferRecommendations>[number] & {
          sourceBranchId: string;
          targetBranchId: string;
        })
      | undefined;

    for (const source of productStats) {
      for (const target of productStats) {
        if (source.retailStoreId === target.retailStoreId) continue;

        const recommendation = buildTransferRecommendations(
          [source],
          [target],
          rules,
        )[0];

        if (!recommendation) continue;

        const candidate = {
          ...recommendation,
          sourceBranchId: source.retailStoreId,
          targetBranchId: target.retailStoreId,
        };

        if (
          !bestRecommendation ||
          candidate.score > bestRecommendation.score ||
          (candidate.score === bestRecommendation.score &&
            candidate.estimatedAdditional30DaySales >
              bestRecommendation.estimatedAdditional30DaySales) ||
          (candidate.score === bestRecommendation.score &&
            candidate.estimatedAdditional30DaySales ===
              bestRecommendation.estimatedAdditional30DaySales &&
            candidate.suggestedQuantity > bestRecommendation.suggestedQuantity)
        ) {
          bestRecommendation = candidate;
        }
      }
    }

    if (bestRecommendation) recommendations.push(bestRecommendation);
  }

  return recommendations.sort(
    (left, right) =>
      right.score - left.score ||
      right.estimatedAdditional30DaySales -
        left.estimatedAdditional30DaySales ||
      right.suggestedQuantity - left.suggestedQuantity ||
      left.productName.localeCompare(right.productName),
  );
}
