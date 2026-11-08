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

export interface NormalizedGpuComparison extends GpuComparison {
  customerPerGpuHourUsd: number | null;
  additionalCostPerGpuHourUsd: number;
  estimatedMarginPerGpuHourUsd: number | null;
  estimatedMarginTotalOfferHourUsd: number | null;
  pricingBasis: 'PER_GPU_HOUR';
  availabilityVerified: false;
  checkedAt: string;
}

export function compareGpuOffersPerGpu(
  offers: GpuOffer[],
  customerPerGpuHourUsd?: number,
  additionalCostPerGpuHourUsd = 0
): NormalizedGpuComparison[] {
  if (
    customerPerGpuHourUsd !== undefined &&
    (!Number.isFinite(customerPerGpuHourUsd) ||
     customerPerGpuHourUsd <= 0)
  ) {
    throw new Error('INVALID_CUSTOMER_PRICE');
  }

  if (
    !Number.isFinite(additionalCostPerGpuHourUsd) ||
    additionalCostPerGpuHourUsd < 0
  ) {
    throw new Error('INVALID_ADDITIONAL_COST');
  }

  const source = new Map(
    offers.map(o => [`${o.provider}:${o.offerId}`, o])
  );

  return compareGpuOffers(offers).map(row => {
    const original = source.get(
      `${row.provider}:${row.offerId}`
    );

    const margin =
      customerPerGpuHourUsd === undefined
        ? null
        : customerPerGpuHourUsd -
          row.supplierPerGpuHourUsd -
          additionalCostPerGpuHourUsd;

    return {
      ...row,
      customerHourlyUsd:
        customerPerGpuHourUsd === undefined
          ? null
          : customerPerGpuHourUsd * row.gpuCount,
      estimatedMarginUsd:
        margin === null ? null : margin * row.gpuCount,
      customerPerGpuHourUsd:
        customerPerGpuHourUsd ?? null,
      additionalCostPerGpuHourUsd,
      estimatedMarginPerGpuHourUsd: margin,
      estimatedMarginTotalOfferHourUsd:
        margin === null ? null : margin * row.gpuCount,
      estimatedMarginPct:
        margin === null
          ? null
          : margin / customerPerGpuHourUsd! * 100,
      pricingBasis: 'PER_GPU_HOUR',
      availabilityVerified: false,
      checkedAt: original?.checkedAt ?? ''
    };
  });
}
