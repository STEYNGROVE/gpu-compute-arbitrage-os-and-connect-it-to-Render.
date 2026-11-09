import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareGpuOffersPerGpu } from './gpuPriceComparison.js';
import { assessGpuOffer } from './gpuOfferEvidence.js';
import type { GpuOffer } from './gpuPriceComparison.js';

const sample: GpuOffer = {
  provider: 'vast_ai',
  offerId: 'test-4090',
  model: 'RTX 4090',
  gpuCount: 2,
  vramGb: 24,
  region: null,
  totalHourlyUsd: 0.80,
  available: null,
  checkedAt: new Date().toISOString()
};

function compareWithEvidence(offers: GpuOffer[]) {
  return compareGpuOffersPerGpu(offers).map(offer => ({
    ...offer,
    evidence: assessGpuOffer({
      provider: offer.provider as 'vast_ai' | 'runpod',
      offerId: offer.offerId,
      model: offer.model,
      gpuCount: offer.gpuCount,
      pricePerGpuHourUsd: offer.supplierPerGpuHourUsd,
      checkedAt: offer.checkedAt,
      capacityVerified: false,
      available: null,
      source: 'SUPPLIER_CATALOG'
    })
  }));
}

test('catalog pricing is never capacity verified', () => {
  const [result] = compareWithEvidence([sample]);
  assert.equal(result.evidence.status, 'CATALOG_ONLY');
  assert.equal(result.availabilityVerified, false);
  assert.equal(result.evidence.purchasingAllowed, false);
});

test('expired supplier evidence fails closed', () => {
  const [result] = compareWithEvidence([{
    ...sample,
    checkedAt: '2020-01-01T00:00:00Z'
  }]);
  assert.equal(result.evidence.status, 'STALE');
  assert.equal(result.evidence.eligibleForManualReview, false);
});

test('all supplier catalog offers remain non-purchasable', () => {
  const results = compareWithEvidence([
    sample,
    {
      ...sample,
      provider: 'runpod',
      offerId: 'test-a100',
      model: 'A100'
    }
  ]);

  assert.equal(results.length, 2);

  for (const result of results) {
    assert.equal(result.evidence.purchasingAllowed, false);
    assert.equal(result.evidence.paymentVerified, false);
    assert.equal(result.availabilityVerified, false);
    assert.notEqual(
      result.evidence.status,
      'CAPACITY_VERIFIED'
    );
  }
});

test('invalid GPU pricing is excluded', () => {
  const results = compareWithEvidence([{
    ...sample,
    totalHourlyUsd: -1
  }]);

  assert.equal(results.length, 0);
});
