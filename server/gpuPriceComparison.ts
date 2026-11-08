export interface GpuOffer {
  provider: 'vast_ai' | 'runpod';
  offerId: string;
  model: string;
  gpuCount: number;
  vramGb: number | null;
  region: string | null;
  totalHourlyUsd: number;
  available: boolean | null;
  checkedAt: string;
}

export interface GpuComparison {
  provider: string;
  offerId: string;
  model: string;
  gpuCount: number;
  supplierHourlyUsd: number;
  supplierPerGpuHourUsd: number;
  customerHourlyUsd: number | null;
  estimatedMarginUsd: number | null;
  estimatedMarginPct: number | null;
  status: 'CATALOG_ONLY';
}

export function compareGpuOffers(
  offers: GpuOffer[],
  customerHourlyUsd?: number,
  additionalCostHourlyUsd = 0
): GpuComparison[] {
  const validQuote =
    customerHourlyUsd !== undefined &&
    Number.isFinite(customerHourlyUsd) &&
    customerHourlyUsd > 0;

  if (!Number.isFinite(additionalCostHourlyUsd) ||
      additionalCostHourlyUsd < 0) {
    throw new Error('INVALID_ADDITIONAL_COST');
  }

  return offers
    .filter(o =>
      o.offerId.length > 0 &&
      o.gpuCount > 0 &&
      Number.isInteger(o.gpuCount) &&
      Number.isFinite(o.totalHourlyUsd) &&
      o.totalHourlyUsd > 0
    )
    .map(o => {
      const cost = o.totalHourlyUsd + additionalCostHourlyUsd;
      const margin = validQuote
        ? customerHourlyUsd! - cost
        : null;

      return {
        provider: o.provider,
        offerId: o.offerId,
        model: o.model,
        gpuCount: o.gpuCount,
        supplierHourlyUsd: o.totalHourlyUsd,
        supplierPerGpuHourUsd:
          o.totalHourlyUsd / o.gpuCount,
        customerHourlyUsd: validQuote
          ? customerHourlyUsd!
          : null,
        estimatedMarginUsd: margin,
        estimatedMarginPct: margin === null
          ? null
          : (margin / customerHourlyUsd!) * 100,
        status: 'CATALOG_ONLY' as const
      };
    })
    .sort((a, b) =>
      a.supplierPerGpuHourUsd -
      b.supplierPerGpuHourUsd
    );
}
