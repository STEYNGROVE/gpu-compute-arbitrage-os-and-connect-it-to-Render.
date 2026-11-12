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
  platformFeePct?: number;
  utilizationPct?: number;
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
  currency: 'USD';
  fxStatus: 'NOT_REQUIRED_USD_ONLY';
  platformFeeUsd: number;
  utilizationPct: number;
  validUntil: string;
  contractRequired: true;
  realizedRevenueUsd: 0;
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
    minimumMarginPct,
    platformFeePct = 0,
    utilizationPct = 100
  } = input;

  if (
    !Number.isFinite(platformFeePct) || platformFeePct < 0 || platformFeePct >= 100 ||
    !Number.isFinite(utilizationPct) || utilizationPct <= 0 || utilizationPct > 100 ||
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

      const platformFeeUsd = match.quotedRevenueUsd * utilizationPct / 100 * platformFeePct / 100;
      const totalEstimatedCostUsd =
        supplierCostUsd +
        additionalCostUsd + platformFeeUsd +
        contingencyUsd;

      const customerRevenueUsd =
        match.quotedRevenueUsd * utilizationPct / 100;

      const estimatedGrossProfitUsd =
        customerRevenueUsd -
        totalEstimatedCostUsd;

      const estimatedMarginPct =
        customerRevenueUsd > 0
          ? estimatedGrossProfitUsd /
            customerRevenueUsd * 100
          : -100;

      return {
        currency: 'USD' as const,
        fxStatus: 'NOT_REQUIRED_USD_ONLY' as const,
        platformFeeUsd,
        utilizationPct,
        validUntil: new Date(Date.parse(match.checkedAt) + 15 * 60000).toISOString(),
        contractRequired: true as const,
        realizedRevenueUsd: 0 as const,
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
      Number.isFinite(candidate.totalEstimatedCostUsd) &&
      Number.isFinite(candidate.customerRevenueUsd) &&
      Number.isFinite(candidate.estimatedGrossProfitUsd) &&
      candidate.estimatedGrossProfitUsd > 0 &&
      candidate.estimatedMarginPct >= minimumMarginPct
    )
    .sort((a, b) =>
      b.estimatedGrossProfitUsd -
      a.estimatedGrossProfitUsd
    );
}
