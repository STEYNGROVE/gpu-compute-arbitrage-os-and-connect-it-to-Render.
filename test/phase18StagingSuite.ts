import assert from 'node:assert/strict';
import express from 'express';
import { rateLimit } from '../server/rateLimit.js';
import { assessGatewayDrill, assessDatabaseDrill, evidenceDigest, snapshotReview } from '../server/launchReadiness/certificationDrills.js';
import { assessSupplierEvidence, assessPrepaidPayment, reconcileTermination, requestPurchase } from '../server/launchReadiness/boundaries.js';
import { classifyBuyerEvidence } from '../server/buyerEvidenceImport.js';
import { evaluateGpuMatches } from '../server/gpuArbitrageDiscovery.js';
import { smoke, BASELINE, STAGING } from '../scripts/staging-smoke.mjs';

const now = 1_800_000_000_000;
const base = { id: 'fixture', subjectId: 'runpod', accountId: 'fixture-account', observedAtMs: now - 1000, expiresAtMs: now + 1000 };
function bind<T extends object>(content: T) {
  const { payloadSha256: _, ...payload } = content as T & { payloadSha256?: string };
  return { ...payload, payloadSha256: evidenceDigest(payload as any) };
}
const supplier = bind({ ...base, provider: 'runpod' as const, currency: 'USD' as const, balanceCents: 200, billingMode: 'PREPAID' as const, autoChargeDisabled: true });
const review = snapshotReview(supplier, 'offline-source', 'offline-reviewer');
assert(assessSupplierEvidence(supplier, 'runpod', base.accountId, now, review).acceptedForReview);
for (const patch of [{ balanceCents: 201 }, { accountId: 'other' }, { autoChargeDisabled: false }, { expiresAtMs: now + 300001 }]) {
  assert.equal(assessSupplierEvidence({ ...supplier, ...patch }, 'runpod', base.accountId, now, review).acceptedForReview, false);
}
const payment = bind({ ...base, subjectId: 'order', customerId: 'buyer', rail: 'BINANCE' as const, currency: 'USD' as const, amountCents: 200, externalEventId: 'event', state: 'FINAL' as const });
const payReview = snapshotReview(payment, 'offline-source', 'offline-reviewer');
assert(assessPrepaidPayment(payment, 'order', 'buyer', base.accountId, 200, now, payReview).acceptedForReview);
for (const patch of [{ amountCents: 201 }, { externalEventId: ' ' }, { customerId: 'foreign' }, { state: 'REVERSED' as const }]) {
  const altered = bind({ ...payment, ...patch });
  assert.equal(assessPrepaidPayment(altered, 'order', 'buyer', base.accountId, 200, now, snapshotReview(altered, 'source', 'reviewer')).acceptedForReview, false);
}
const termination = bind({ ...base, subjectId: 'instance', instanceId: 'instance', providerState: 'TERMINATED' as const, startedAtMs: now - 10000, stoppedAtMs: now - 2000, finalCostCents: 100, invoiceId: 'invoice', invoiceFinal: true });
const stopCheck = (e: typeof termination) => reconcileTermination(e, 'instance', base.accountId, 200, now - 1500, now, snapshotReview(e, 'source', 'reviewer'));
assert(stopCheck(termination).acceptedForReview);
for (const patch of [{ invoiceId: ' ' }, { stoppedAtMs: now }, { finalCostCents: 201 }, { invoiceFinal: false }]) assert.equal(stopCheck(bind({ ...termination, ...patch })).acceptedForReview, false);
const journal = [
  { requestId: 'job', provider: 'runpod' as const, kind: 'RESERVED' as const, costCents: 200 },
  { requestId: 'job', provider: 'runpod' as const, kind: 'INTENT' as const },
  { requestId: 'job', provider: 'runpod' as const, kind: 'AMBIGUOUS' as const }
];
// An ambiguous dispatch cannot retry after restart without an independent absence reconciliation.
assert.equal(assessGatewayDrill([...journal, journal[1]]).acceptedForReview, false);
assert(assessGatewayDrill([...journal, { ...journal[1], kind: 'RECONCILED_ABSENT' }, journal[1], { ...journal[1], kind: 'TERMINATED' }]).acceptedForReview);
assert(assessGatewayDrill([...journal, { ...journal[1], kind: 'QUARANTINED' }]).acceptedForReview);
assert.equal(assessGatewayDrill([...journal, { ...journal[0], provider: 'vast_ai' }]).acceptedForReview, false);
assert.equal(assessGatewayDrill([...journal, { ...journal[0], requestId: 'second' }]).acceptedForReview, false);
const completed = [journal[0], journal[1], { ...journal[1], kind: 'TERMINATED' as const }];
assert.equal(assessGatewayDrill([...completed, ...completed]).acceptedForReview, false, 'duplicate reservation rejected');
assert.equal(assessGatewayDrill([...completed, ...completed.map(e => ({ ...e, requestId: 'two' })), ...completed.map(e => ({ ...e, requestId: 'three' }))]).acceptedForReview, false, 'daily cap enforced across completed jobs');
const dbProof = { isolated: true, workers: 2, reservations: 1, duplicateCredits: 0, rollbackVerified: true, restartVerified: true, migrationReplayVerified: true };
assert(assessDatabaseDrill(dbProof).acceptedForReview);
for (const patch of [{ isolated: false }, { workers: 1 }, { duplicateCredits: 1 }, { migrationReplayVerified: false }, { restartVerified: false }]) assert.equal(assessDatabaseDrill({ ...dbProof, ...patch }).acceptedForReview, false);
for (const assessment of [stopCheck(termination), assessDatabaseDrill(dbProof), await requestPurchase({ live: true })]) assert.equal(assessment.executionAuthorized, false);
assert.throws(() => evidenceDigest({ cost: NaN }), /INVALID_CANONICAL/);

for (const [title, source, category] of [
  ['We need GPU cloud capacity, please quote', 'procurement', 'BUYER_REQUEST_REVIEW'],
  ['We offer GPU cloud capacity', 'vendor', 'SUPPLIER_OFFER'],
  ['We need GPU cloud capacity', 'reddit', 'DISCUSSION_ONLY'],
  ['We are hiring GPU engineer', 'jobs', 'EMPLOYMENT']]) {
  const result = classifyBuyerEvidence(title, '', source);
  assert.equal(result.category, category); assert.equal(result.buyerIntentConfirmed, false); assert.equal(result.verifiedCustomer, false);
}
const matches = evaluateGpuMatches([{ provider: 'fixture', offerId: 'offer', gpu: 'H100', gpuCount: 1, hourlyUsd: 1, verified: true, available: true, evidenceUrl: 'https://example.com/supply', observedAt: new Date().toISOString() }], [{ source: 'fixture', orderId: 'order', gpu: 'H100', gpuCount: 1, maxHourlyUsd: 3, durationHours: 1, evidenceUrl: 'https://example.com/demand', observedAt: new Date().toISOString(), customerVerified: true, fundsVerified: true, fulfillmentCompatible: true }], { minimumNetMargin: 0.35, maxHourlyWholesaleUsd: 2, reservePct: 0.15 });
assert.equal(matches.length, 1); assert.equal(matches[0].executionEligible, false); assert.equal(matches[0].realizedRevenueUsd, 0);

// Exercise the smoke contract offline, including wrong revision and unexpected access.
const fixtureFetch = async (url: string, init: RequestInit) => {
  assert(url.startsWith(STAGING)); assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error');
  const path = new URL(url).pathname;
  return new Response(JSON.stringify(path === '/api/ready' ? { status: 'ready', database: 'connected', revision: BASELINE } : path.includes('healthz') ? { status: 'ok' } : { error: 'OWNER_AUTHENTICATION_REQUIRED' }), { status: path.includes('healthz') || path === '/api/ready' ? 200 : 403, headers: { 'cache-control': 'no-store' } });
};
assert.equal((await smoke({ request: fixtureFetch as any, expectedRevision: BASELINE })).passed, 13);
const currentRevision = 'a'.repeat(40);
await assert.rejects(smoke({ request: fixtureFetch as any, expectedRevision: currentRevision }), /strictly equal/,
  'a current expected commit must reject a readiness response reporting the old fixture commit');
await assert.rejects(smoke({ request: fixtureFetch as any, expectedRevision: '' }), /40-character lowercase hexadecimal/);
await assert.rejects(smoke({ request: fixtureFetch as any, expectedRevision: undefined }), /EXPECTED_STAGING_REVISION or GITHUB_SHA is required/);
const priorGithubSha = process.env.GITHUB_SHA;
try {
  process.env.GITHUB_SHA = currentRevision;
  await assert.rejects(smoke({ request: fixtureFetch as any }), /strictly equal/,
    'the workflow SHA fallback must still reject stale readiness');
} finally {
  if (priorGithubSha === undefined) delete process.env.GITHUB_SHA;
  else process.env.GITHUB_SHA = priorGithubSha;
}
await assert.rejects(smoke({ request: fixtureFetch as any, expectedRevision: '0'.repeat(40) }));
await assert.rejects(smoke({ request: async () => new Response('{}', { status: 200 }) }));

let time = 1000;
const app = express(); app.use(rateLimit(2, 100, 2, () => time)); app.get('/', (_req, res) => res.json({ ok: true }));
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.listening ? resolve() : server.once('listening', resolve));
try {
  const address = server.address(); assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/`;
  for (let i = 0; i < 3; i++) {
    const response = await fetch(url, { headers: { 'X-Forwarded-For': `198.51.100.${i}` } });
    assert.equal(response.status, i < 2 ? 200 : 429);
    if (i === 2) assert.equal(response.headers.get('retry-after'), '1');
  }
  time += 100; assert.equal((await fetch(url)).status, 200);
} finally { await new Promise<void>(resolve => server.close(() => resolve())); }
console.log('PASS: Phase 18 offline certification, discovery, smoke failure contracts and forwarding-header rate-limit bypass rejection');
