import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assessGpuOffer,
  type GpuOfferEvidence
} from './gpuOfferEvidence.js';

const now = Date.parse('2026-11-08T17:15:00Z');

const valid: GpuOfferEvidence = {
  provider: 'vast_ai',
  offerId: 'test-offer',
  model: 'RTX 4090',
  gpuCount: 1,
  pricePerGpuHourUsd: 0.34,
  checkedAt: '2026-11-08T17:14:00Z',
  capacityVerified: false,
  available: null,
  source: 'supplier-catalog'
};

test('catalog offer never proves capacity', () => {
  const result = assessGpuOffer(valid, now);
  assert.equal(result.status, 'CATALOG_ONLY');
  assert.equal(result.purchasingAllowed, false);
});

test('expired evidence becomes stale', () => {
  const result = assessGpuOffer({
    ...valid,
    checkedAt: '2026-11-08T16:00:00Z'
  }, now);

  assert.equal(result.status, 'STALE');
});

test('unavailable capacity is rejected', () => {
  const result = assessGpuOffer({
    ...valid,
    available: false
  }, now);

  assert.equal(result.status, 'UNAVAILABLE');
});

test('capacity evidence allows review, not purchase', () => {
  const result = assessGpuOffer({
    ...valid,
    capacityVerified: true,
    available: true
  }, now);

  assert.equal(result.status, 'CAPACITY_VERIFIED');
  assert.equal(result.eligibleForManualReview, true);
  assert.equal(result.purchasingAllowed, false);
  assert.equal(result.paymentVerified, false);
});

test('future timestamps fail closed', () => {
  const result = assessGpuOffer({
    ...valid,
    checkedAt: '2026-11-09T17:14:00Z'
  }, now);

  assert.equal(result.status, 'STALE');
});

test('invalid prices fail closed', () => {
  const result = assessGpuOffer({
    ...valid,
    pricePerGpuHourUsd: -1
  }, now);

  assert.equal(result.status, 'STALE');
});
