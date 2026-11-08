import assert from 'node:assert/strict';
import { compareGpuOffersPerGpu } from '../server/gpuPriceComparison.js';
import { matchGpuDemand } from '../server/gpuDemandMatcher.js';

const offers = [{
  provider: 'vast_ai' as const,
  offerId: 'synthetic-4090',
  model: 'RTX 4090',
  gpuCount: 2,
  vramGb: 24,
  region: null,
  totalHourlyUsd: 2,
  available: null,
  checkedAt: new Date().toISOString()
}];

const requirement = {
  gpuModel: '4090',
  gpuCount: 2,
  durationHours: 10,
  maxCustomerPricePerGpuHourUsd: 2
};

const additionalCostPerGpuHourUsd = 0.25;

const normalized = compareGpuOffersPerGpu(
  offers,
  requirement.maxCustomerPricePerGpuHourUsd,
  additionalCostPerGpuHourUsd
);

assert.equal(normalized.length, 1);
assert.equal(normalized[0].estimatedMarginPerGpuHourUsd, 0.75);

const matches = matchGpuDemand(requirement, normalized);
assert.equal(matches.length, 1);

const match = matches[0];
const additionalCost =
  additionalCostPerGpuHourUsd *
  requirement.gpuCount *
  requirement.durationHours;

const finalSpread =
  match.estimatedGrossSpreadUsd - additionalCost;

assert.equal(match.quotedRevenueUsd, 40);
assert.equal(match.estimatedSupplierCostUsd, 20);
assert.equal(additionalCost, 5);
assert.equal(finalSpread, 15);

assert.equal(match.status, 'CATALOG_MATCH_ONLY');
assert.equal(match.availabilityVerified, false);
assert.equal(match.paymentVerified, false);
assert.equal(match.purchasingAllowed, false);

const expensive = compareGpuOffersPerGpu(
  offers,
  1,
  0.25
);

const rejected = matchGpuDemand(
  {
    ...requirement,
    maxCustomerPricePerGpuHourUsd: 1
  },
  expensive
);

assert.equal(rejected.length, 0);

console.log(
  'PASS: GPU financial calculations and safety boundaries'
);
