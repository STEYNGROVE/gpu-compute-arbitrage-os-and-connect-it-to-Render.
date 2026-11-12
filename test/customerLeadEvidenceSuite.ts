import assert from 'node:assert/strict';
import {
  assessCustomerLeadEvidence
} from '../server/customerLeadEvidence.js';

const now = new Date('2026-11-12T12:00:00Z');

const base = {
  title: 'Managed inference requirement',
  description: 'Customer requests batch inference.',
  sourceUrl: 'https://example.com/rfq/123',
  publishedAt: '2026-11-10T12:00:00Z',
  buyerIdentity: 'Example organization',
  requirementDetails: 'Batch inference workload'
};

const candidate = assessCustomerLeadEvidence({
  ...base,
  buyerIdentity: null,
  requirementDetails: null
}, now);

assert.equal(candidate.status, 'CANDIDATE');
assert.equal(candidate.verifiedCustomer, false);

const review = assessCustomerLeadEvidence(base, now);
assert.equal(review.status, 'REVIEW_REQUIRED');

const confirmation = assessCustomerLeadEvidence({
  ...base,
  customerConfirmationReference: 'external-reference-123'
}, now);

assert.equal(
  confirmation.status,
  'CUSTOMER_CONFIRMATION_RECORDED'
);
assert.equal(confirmation.verifiedCustomer, false);
assert.equal(confirmation.paymentVerified, false);

const stale = assessCustomerLeadEvidence({
  ...base,
  publishedAt: '2026-08-01T12:00:00Z'
}, now);

assert.notEqual(stale.status, 'REVIEW_REQUIRED');
assert(stale.reasons.includes('STALE_OR_FUTURE_PUBLICATION'));

const missingDate = assessCustomerLeadEvidence({
  ...base,
  publishedAt: null
}, now);

assert.notEqual(missingDate.status, 'REVIEW_REQUIRED');

const invalidUrl = assessCustomerLeadEvidence({
  ...base,
  sourceUrl: 'http://localhost/private'
}, now);

assert.equal(invalidUrl.status, 'INSUFFICIENT_EVIDENCE');

console.log('PASS: 6 customer evidence assessment cases');
for (const publishedAt of ['2026-02-30T12:00:00Z', '2026-11-10T12:00:00', '2026-11-10', '2026-13-01T00:00:00Z']) {
  const result = assessCustomerLeadEvidence({...base, publishedAt}, now);
  assert.equal(result.status, 'CANDIDATE');
  assert(result.reasons.includes('MISSING_OR_INVALID_PUBLICATION_DATE'));
}
for (const title of ['', '   ']) {
  const result = assessCustomerLeadEvidence({...base, title, customerConfirmationReference: 'reference'}, now);
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  assert.equal(result.paymentVerified, false);
  assert.equal(result.realizedRevenueUsd, 0);
}
for (const timezone of ['UTC', 'Pacific/Honolulu', 'Asia/Tokyo']) {
  const previous = process.env.TZ;
  try {
    process.env.TZ = timezone;
    assert.equal(assessCustomerLeadEvidence({...base, publishedAt: '2026-11-10T12:00:00'}, now).status, 'CANDIDATE');
    assert.equal(assessCustomerLeadEvidence(base, now).status, 'REVIEW_REQUIRED');
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
}
