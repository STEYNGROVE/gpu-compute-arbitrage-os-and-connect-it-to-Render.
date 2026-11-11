import {
  matchGpuDemand,
  type CustomerRequirement
} from './gpuDemandMatcher.js';

import type {
  NormalizedGpuComparison
} from './gpuPriceComparison.js';

export interface CommercialQuoteInput {
  requirement: CustomerRequirement;
  catalog: NormalizedGpuComparison[];
  additionalCostUsd: number;
  contingencyPct: number;
  minimumMarginPct: number;
}

export interface CommercialQuoteCandidate {
  provider: string;
  offerId: string;
  model: string;
  gpuCount: number;
  hours: number;
  checkedAt: string;
  supplierCostUsd: number;
  additionalCostUsd: number;
  contingencyUsd: number;
  totalEstimatedCostUsd: number;
  customerRevenueUsd: number;
  estimatedGrossProfitUsd: number;
  estimatedMarginPct: number;
  status: 'DRAFT_REQUIRES_VERIFICATION';
  availabilityVerified: false;
  paymentVerified: false;
  purchasingAllowed: false;
}

export function planCommercialQuotes(
  input: CommercialQuoteInput
): CommercialQuoteCandidate[] {
  const {
    requirement,
    catalog,
    additionalCostUsd,
    contingencyPct,
    minimumMarginPct
  } = input;

  if (
    !Number.isFinite(additionalCostUsd) ||
    additionalCostUsd < 0 ||
    !Number.isFinite(contingencyPct) ||
    contingencyPct < 0 ||
    contingencyPct > 100 ||
    !Number.isFinite(minimumMarginPct) ||
    minimumMarginPct < 0 ||
    minimumMarginPct >= 100
  ) {
    throw new Error('INVALID_COMMERCIAL_POLICY');
  }

  const matches = matchGpuDemand(
    requirement,
    catalog,
    15
  );

  return matches
    .map(match => {
      const supplierCostUsd =
        match.estimatedSupplierCostUsd;

      const contingencyUsd =
        supplierCostUsd * contingencyPct / 100;

      const totalEstimatedCostUsd =
        supplierCostUsd +
        additionalCostUsd +
        contingencyUsd;

      const customerRevenueUsd =
        match.quotedRevenueUsd;

      const estimatedGrossProfitUsd =
        customerRevenueUsd -
        totalEstimatedCostUsd;

      const estimatedMarginPct =
        customerRevenueUsd > 0
          ? estimatedGrossProfitUsd /
            customerRevenueUsd * 100
          : -100;

      return {
        provider: match.provider,
        offerId: match.offerId,
        model: match.model,
        gpuCount: requirement.gpuCount,
        hours: requirement.durationHours,
        checkedAt: match.checkedAt,
        supplierCostUsd,
        additionalCostUsd,
        contingencyUsd,
        totalEstimatedCostUsd,
        customerRevenueUsd,
        estimatedGrossProfitUsd,
        estimatedMarginPct,
        status: 'DRAFT_REQUIRES_VERIFICATION' as const,
        availabilityVerified: false as const,
        paymentVerified: false as const,
        purchasingAllowed: false as const
      };
    })
    .filter(candidate =>
      candidate.estimatedGrossProfitUsd > 0 &&
      candidate.estimatedMarginPct >= minimumMarginPct
    )
    .sort((a, b) =>
      b.estimatedGrossProfitUsd -
      a.estimatedGrossProfitUsd
    );
}
