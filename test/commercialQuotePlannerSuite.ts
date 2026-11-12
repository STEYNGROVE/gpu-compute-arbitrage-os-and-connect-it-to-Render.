import assert from 'node:assert/strict';

import {
  planCommercialQuotes
} from '../server/commercialQuotePlanner.js';

import type {
  NormalizedGpuComparison
} from '../server/gpuPriceComparison.js';

const offer: NormalizedGpuComparison = {
  provider: 'vast_ai',
  offerId: 'test-offer',
  model: 'H100',
  gpuCount: 4,
  supplierHourlyUsd: 6,
  supplierPerGpuHourUsd: 1.5,
  customerHourlyUsd: null,
  estimatedMarginUsd: null,
  estimatedMarginPct: null,
  customerPerGpuHourUsd: null,
  additionalCostPerGpuHourUsd: 0,
  estimatedMarginPerGpuHourUsd: null,
  estimatedMarginTotalOfferHourUsd: null,
  pricingBasis: 'PER_GPU_HOUR',
  availabilityVerified: false,
  checkedAt: new Date().toISOString(),
  status: 'CATALOG_ONLY'
};

const base = {
  requirement: {
    gpuModel: 'H100',
    gpuCount: 4,
    durationHours: 100,
    maxCustomerPricePerGpuHourUsd: 2.1
  },
  catalog: [offer],
  additionalCostUsd: 20,
  contingencyPct: 10,
  minimumMarginPct: 10
};

const quotes = planCommercialQuotes(base);

assert.equal(quotes.length, 1);
assert.equal(quotes[0].supplierCostUsd, 600);
assert.equal(quotes[0].customerRevenueUsd, 840);
assert.equal(quotes[0].contingencyUsd, 60);
assert.equal(quotes[0].totalEstimatedCostUsd, 680);
assert.equal(quotes[0].estimatedGrossProfitUsd, 160);
assert.equal(quotes[0].purchasingAllowed, false);
assert.equal(quotes[0].availabilityVerified, false);
assert.equal(quotes[0].paymentVerified, false);

assert.equal(
  planCommercialQuotes({
    ...base,
    minimumMarginPct: 25
  }).length,
  0
);

assert.equal(
  planCommercialQuotes({
    ...base,
    catalog: [{
      ...offer,
      checkedAt: new Date(
        Date.now() - 3600000
      ).toISOString()
    }]
  }).length,
  0
);

assert.throws(() =>
  planCommercialQuotes({
    ...base,
    contingencyPct: -1
  })
);

console.log(
  'PASS: Commercial quotation integration'
);
console.log(
  'PASS: Supplier cost and profit calculations'
);
console.log(
  'PASS: Margin protection'
);
console.log(
  'PASS: Stale catalogue rejection'
);
console.log(
  'PASS: Financial execution blocked'
);
assert.equal(planCommercialQuotes({...base, platformFeePct: 5, utilizationPct: 95}).length, 0, 'Fees and utilization must enforce the existing 10% margin floor');
const withFees = planCommercialQuotes({...base, minimumMarginPct: 5, platformFeePct: 5, utilizationPct: 95});
assert.equal(withFees.length, 1);
assert.equal(withFees[0].customerRevenueUsd, 798);
assert.equal(withFees[0].platformFeeUsd, 39.9);
assert.equal(withFees[0].currency, 'USD');
assert.equal(withFees[0].realizedRevenueUsd, 0);
assert.equal(withFees[0].contractRequired, true);
assert.equal(withFees[0].validUntil, new Date(Date.parse(offer.checkedAt) + 15 * 60000).toISOString());
for (const bad of [NaN, Infinity, -1, 100]) assert.throws(() => planCommercialQuotes({...base, platformFeePct: bad}));
for (const bad of [NaN, Infinity, -1, 0, 101]) assert.throws(() => planCommercialQuotes({...base, utilizationPct: bad}));
for (const price of [-1, NaN, Infinity]) assert.equal(planCommercialQuotes({...base, catalog: [{...offer, supplierHourlyUsd: price}]}).length, 0);
assert.equal(planCommercialQuotes({...base, catalog: [{...offer, supplierHourlyUsd: 1}]}).length, 0);
