import assert from 'node:assert/strict';
import { RunpodProvider } from '../server/providers/runpodProvider.js';
import {
  assessSupplierEvidence, assessPrepaidPayment, reconcileTermination, requestPurchase,
  type SupplierEvidence, type PaymentEvidence, type TerminationEvidence, type IndependentReview
} from '../server/launchReadiness/boundaries.js';

const now = 1_800_000_000_000;
const base = { id: 'offline-evidence', subjectId: 'runpod', accountId: 'offline-account', observedAtMs: now - 1000,
  expiresAtMs: now + 1000, payloadSha256: 'a'.repeat(64) };
// Exact fixture comparison models independently bound content; it does not verify live evidence.
const reviewFor = (e: object): IndependentReview => ({ source: 'fixture-source', reviewer: 'fixture-reviewer', verify: candidate => JSON.stringify(candidate) === JSON.stringify(e) });
const supplier: SupplierEvidence = { ...base, provider: 'runpod', currency: 'USD', balanceCents: 200, billingMode: 'PREPAID', autoChargeDisabled: true };
const supplierCheck = (e: SupplierEvidence, review = reviewFor(supplier)) => assessSupplierEvidence(e, 'runpod', 'offline-account', now, review);
assert(supplierCheck(supplier).acceptedForReview);
for (const patch of [{ balanceCents: NaN }, { balanceCents: 0.1 }, { balanceCents: -1 }, { accountId: 'other' },
  { autoChargeDisabled: false }, { expiresAtMs: now }, { observedAtMs: now + 1 }, { observedAtMs: now - 300001 },
  { payloadSha256: '' }, { provider: 'vast_ai' }, { currency: 'ZAR' }]) {
  const changed = { ...supplier, ...patch } as SupplierEvidence;
  assert.equal(supplierCheck(changed, reviewFor(changed)).acceptedForReview, false);
}
assert.equal(supplierCheck({ ...supplier, balanceCents: 999 }).acceptedForReview, false, 'Changed financial payload must not reuse old review');
assert.equal(supplierCheck(supplier, { ...reviewFor(supplier), reviewer: 'fixture-source' }).acceptedForReview, false);
assert.equal(supplierCheck(supplier, { ...reviewFor(supplier), verify: () => { throw Error('offline'); } }).acceptedForReview, false);
const payment: PaymentEvidence = { ...base, subjectId: 'order', customerId: 'customer', rail: 'BINANCE', currency: 'USD', amountCents: 200, externalEventId: 'fixture-event', state: 'FINAL' };
const paymentCheck = (e: PaymentEvidence) => assessPrepaidPayment(e, 'order', 'customer', 'offline-account', 200, now, reviewFor(e));
assert(paymentCheck(payment).acceptedForReview);
for (const patch of [{ state: 'PENDING' }, { state: 'REVERSED' }, { amountCents: 199 }, { customerId: 'other' }, { subjectId: 'other' }, { externalEventId: '' }, { rail: 'PAYFAST' }]) {
  assert.equal(paymentCheck({ ...payment, ...patch } as PaymentEvidence).acceptedForReview, false);
}
const termination: TerminationEvidence = { ...base, subjectId: 'instance', instanceId: 'instance', providerState: 'TERMINATED', startedAtMs: now - 10000, stoppedAtMs: now - 2000, finalCostCents: 100, invoiceId: 'fixture-invoice', invoiceFinal: true };
const terminationCheck = (e: TerminationEvidence) => reconcileTermination(e, 'instance', 'offline-account', 200, now - 1500, now, reviewFor(e));
assert(terminationCheck(termination).acceptedForReview);
for (const patch of [{ providerState: 'UNKNOWN' }, { providerState: 'RUNNING' }, { invoiceFinal: false }, { invoiceId: '' },
  { finalCostCents: 201 }, { finalCostCents: NaN }, { stoppedAtMs: now }, { startedAtMs: now }, { instanceId: 'other' }]) {
  const result = terminationCheck({ ...termination, ...patch } as TerminationEvidence);
  assert.equal(result.acceptedForReview, false);
  assert.equal(result.reason, 'QUARANTINE_RECONCILIATION_REQUIRED');
}
for (const result of [supplierCheck(supplier), paymentCheck(payment), terminationCheck(termination), await requestPurchase({ allFlags: true })]) {
  assert.equal(result.executionAuthorized, false);
}
assert.equal((await requestPurchase(undefined)).acceptedForReview, false);

const ambientFetch = globalThis.fetch;
let externalCalls = 0;
globalThis.fetch = async () => { externalCalls++; throw Error('AMBIENT_NETWORK_FORBIDDEN'); };
try {
  let reads = 0;
  let payload: unknown = { data: { myself: { id: 'fixture', clientBalance: 0 } } };
  const adapter = new RunpodProvider({ apiKey: () => 'synthetic-offline-fixture', request: async (url, init) => {
    reads++;
    assert.equal(url, 'https://api.runpod.io/graphql');
    assert.equal(init.method, 'POST');
    assert(!String(init.body).includes('mutation'));
    return new Response(JSON.stringify(payload));
  } });
  assert.equal((await adapter.getBilling()).accountBalanceUsd, 0);
  assert.equal((await adapter.getBilling()).invoiceCount, 0);
  for (const bad of [{ data: {} }, { data: { myself: { id: 'fixture' } } },
    ...[null, '', '12', -1].map(clientBalance => ({ data: { myself: { id: 'fixture', clientBalance } } })),
    { errors: [{ message: 'denied' }], data: { myself: { id: 'fixture', clientBalance: 12 } } }]) {
    payload = bad;
    assert.equal((await adapter.getBilling()).accountBalanceUsd, null);
  }
  payload = { errors: [{}], data: { myself: { id: 'fixture' } } };
  assert.equal((await adapter.healthCheck()).authenticated, false);
  const before = reads;
  assert.equal((await adapter.provision({} as never)).success, false);
  assert.equal((await adapter.terminate('fixture')).success, false);
  assert.equal((await adapter.submitWorkload('fixture', { workloadId: 'offline' } as never)).success, false);
  await assert.rejects(adapter.getUsage('fixture'), /USAGE_UNVERIFIED/);
  assert.equal(reads, before, 'Write and unsupported evidence calls perform no reads or writes');
  const missing = new RunpodProvider({ apiKey: () => '', request: async () => { throw Error('MISSING_KEY_MUST_NOT_REQUEST'); } });
  assert.equal((await missing.healthCheck()).authenticated, false);
  assert.equal((await missing.getBilling()).accountBalanceUsd, null);
  assert.equal(externalCalls, 0);
} finally { globalThis.fetch = ambientFetch; }
console.log('PASS: Phase 16 offline RunPod, supplier/payment binding, termination quarantine and denied gateway boundaries');
