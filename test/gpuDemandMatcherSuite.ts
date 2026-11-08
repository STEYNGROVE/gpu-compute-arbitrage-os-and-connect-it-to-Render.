import assert from 'node:assert/strict';
import { matchGpuDemand } from '../server/gpuDemandMatcher.js';
import type { NormalizedGpuComparison } from '../server/gpuPriceComparison.js';

const now = new Date().toISOString();

function offer(
  gpuCount: number,
  totalHourlyUsd: number,
  checkedAt = now
): NormalizedGpuComparison {
  return {
    provider: 'vast_ai',
    offerId: 'test-offer',
    model: 'RTX 4090',
    gpuCount,
    supplierHourlyUsd: totalHourlyUsd,
    supplierPerGpuHourUsd: totalHourlyUsd / gpuCount,
    customerHourlyUsd: null,
    estimatedMarginUsd: null,
    estimatedMarginPct: null,
    status: 'CATALOG_ONLY',
    customerPerGpuHourUsd: null,
    additionalCostPerGpuHourUsd: 0,
    estimatedMarginPerGpuHourUsd: null,
    estimatedMarginTotalOfferHourUsd: null,
    pricingBasis: 'PER_GPU_HOUR',
    availabilityVerified: false,
    checkedAt
  };
}

const demand = {
  gpuModel: '4090',
  gpuCount: 1,
  durationHours: 10,
  maxCustomerPricePerGpuHourUsd: 0.75
};

const profitable = matchGpuDemand(
  demand,
  [offer(1, 0.40)]
);

assert.equal(profitable.length, 1);
assert.equal(profitable[0].estimatedGrossSpreadUsd, 3.5);
assert.equal(profitable[0].purchasingAllowed, false);
assert.equal(profitable[0].paymentVerified, false);
assert.equal(profitable[0].availabilityVerified, false);

assert.equal(
  matchGpuDemand(demand, [offer(2, 1.00)]).length,
  0,
  'Full two-GPU rental cost must be counted'
);

assert.equal(
  matchGpuDemand(
    demand,
    [offer(1, 0.40, '2020-01-01T00:00:00Z')]
  ).length,
  0,
  'Stale catalog prices must be rejected'
);

assert.throws(
  () => matchGpuDemand(
    { ...demand, gpuCount: 0 },
    [offer(1, 0.40)]
  ),
  /INVALID_CUSTOMER_REQUIREMENT/
);

console.log('PASS: GPU demand matching safety tests');
