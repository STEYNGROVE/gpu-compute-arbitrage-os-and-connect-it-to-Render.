import type { NormalizedGpuComparison } from './gpuPriceComparison.js';

export interface CustomerRequirement {
  gpuModel: string;
  gpuCount: number;
  durationHours: number;
  maxCustomerPricePerGpuHourUsd: number;
}

export interface DemandMatch {
  provider: string;
  offerId: string;
  model: string;
  gpuCount: number;
  catalogCostPerGpuHourUsd: number;
  quotedRevenueUsd: number;
  estimatedSupplierCostUsd: number;
  estimatedGrossSpreadUsd: number;
  checkedAt: string;
  status: 'CATALOG_MATCH_ONLY';
  availabilityVerified: false;
  paymentVerified: false;
  purchasingAllowed: false;
}

export function matchGpuDemand(
  requirement: CustomerRequirement,
  catalog: NormalizedGpuComparison[],
  maxCatalogAgeMinutes = 15
): DemandMatch[] {
  if (
    !requirement.gpuModel?.trim() ||
    !Number.isInteger(requirement.gpuCount) ||
    requirement.gpuCount < 1 ||
    !Number.isFinite(requirement.durationHours) ||
    requirement.durationHours <= 0 ||
    !Number.isFinite(requirement.maxCustomerPricePerGpuHourUsd) ||
    requirement.maxCustomerPricePerGpuHourUsd <= 0
  ) {
    throw new Error('INVALID_CUSTOMER_REQUIREMENT');
  }

  const now = Date.now();

  return catalog
    .filter(offer => {
      const age = now - Date.parse(offer.checkedAt);
      return (
        Number.isFinite(age) &&
        age >= 0 &&
        age <= maxCatalogAgeMinutes * 60000 &&
        offer.model.toLowerCase().includes(
          requirement.gpuModel.trim().toLowerCase()
        ) &&
        Number.isInteger(offer.gpuCount) && offer.gpuCount >= requirement.gpuCount &&
        Number.isFinite(offer.supplierHourlyUsd) && offer.supplierHourlyUsd > 0 &&
        Math.abs(offer.supplierHourlyUsd / offer.gpuCount - offer.supplierPerGpuHourUsd) <= 0.000001 &&
        Number.isFinite(offer.supplierPerGpuHourUsd) &&
        offer.supplierPerGpuHourUsd > 0 &&
        offer.supplierPerGpuHourUsd <=
          requirement.maxCustomerPricePerGpuHourUsd
      );
    })
    .map(offer => {
      const revenue =
        requirement.gpuCount *
        requirement.durationHours *
        requirement.maxCustomerPricePerGpuHourUsd;

      // Conservative: charge for the entire listed offer.
      const supplierCost =
        offer.supplierHourlyUsd *
        requirement.durationHours;

      return {
        provider: offer.provider,
        offerId: offer.offerId,
        model: offer.model,
        gpuCount: offer.gpuCount,
        catalogCostPerGpuHourUsd:
          offer.supplierPerGpuHourUsd,
        quotedRevenueUsd: revenue,
        estimatedSupplierCostUsd: supplierCost,
        estimatedGrossSpreadUsd: revenue - supplierCost,
        checkedAt: offer.checkedAt,
        status: 'CATALOG_MATCH_ONLY' as const,
        availabilityVerified: false as const,
        paymentVerified: false as const,
        purchasingAllowed: false as const
      };
    })
    .filter(match => Number.isFinite(match.estimatedGrossSpreadUsd) && Number.isFinite(match.quotedRevenueUsd) && match.estimatedGrossSpreadUsd > 0)
    .sort(
      (a, b) =>
        b.estimatedGrossSpreadUsd -
        a.estimatedGrossSpreadUsd
    );
}
