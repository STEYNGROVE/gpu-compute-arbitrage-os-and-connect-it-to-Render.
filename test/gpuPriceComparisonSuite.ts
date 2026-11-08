import assert from 'node:assert/strict';
import { compareGpuOffers } from '../server/gpuPriceComparison.js';

const offers = [
  {
    provider: 'vast_ai' as const,
    offerId: 'test-vast-1',
    model: 'RTX 4090',
    gpuCount: 1,
    vramGb: 24,
    region: 'TEST',
    totalHourlyUsd: 0.50,
    available: null,
    checkedAt: new Date().toISOString()
  },
  {
    provider: 'runpod' as const,
    offerId: 'test-runpod-1',
    model: 'RTX 4090',
    gpuCount: 1,
    vramGb: 24,
    region: 'TEST',
    totalHourlyUsd: 0.80,
    available: null,
    checkedAt: new Date().toISOString()
  }
];

const results = compareGpuOffers(offers, 1.20, 0.10);

assert.equal(results.length, 2);
assert.equal(results[0].provider, 'vast_ai');
assert.ok(Math.abs(results[0].estimatedMarginUsd! - 0.60) < 1e-9);
assert.ok(Math.abs(results[1].estimatedMarginUsd! - 0.30) < 1e-9);
assert.equal(results[0].status, 'CATALOG_ONLY');

const noCustomer = compareGpuOffers(offers);
assert.equal(noCustomer[0].estimatedMarginUsd, null);

assert.throws(
  () => compareGpuOffers(offers, 1.20, -1),
  /INVALID_ADDITIONAL_COST/
);

console.log('PASS: GPU comparison, sorting, margins and safety checks');
