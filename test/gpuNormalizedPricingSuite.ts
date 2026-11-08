import assert from 'node:assert/strict';
import {
  compareGpuOffersPerGpu,
  type GpuOffer
} from '../server/gpuPriceComparison.js';

const offers: GpuOffer[] = [{
  provider: 'vast_ai',
  offerId: 'synthetic-8gpu',
  model: 'A100',
  gpuCount: 8,
  vramGb: 80,
  region: null,
  totalHourlyUsd: 3.20,
  available: null,
  checkedAt: '2026-11-08T00:00:00Z'
}];

const result = compareGpuOffersPerGpu(
  offers, 0.75, 0.10
)[0];

assert.equal(result.gpuCount, 8);
assert.ok(Math.abs(result.supplierPerGpuHourUsd - 0.40) < 1e-9);
assert.ok(Math.abs(result.estimatedMarginPerGpuHourUsd! - 0.25) < 1e-9);
assert.ok(Math.abs(result.estimatedMarginTotalOfferHourUsd! - 2.00) < 1e-9);
assert.equal(result.pricingBasis, 'PER_GPU_HOUR');
assert.equal(result.availabilityVerified, false);
assert.equal(result.status, 'CATALOG_ONLY');

const unquoted = compareGpuOffersPerGpu(offers)[0];
assert.equal(unquoted.estimatedMarginPerGpuHourUsd, null);

assert.throws(
  () => compareGpuOffersPerGpu(offers, -1),
  /INVALID_CUSTOMER_PRICE/
);

assert.throws(
  () => compareGpuOffersPerGpu(offers, 1, -0.1),
  /INVALID_ADDITIONAL_COST/
);

console.log('PASS: normalized multi-GPU pricing');
