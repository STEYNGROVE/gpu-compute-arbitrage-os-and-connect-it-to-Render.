/** Offline drill records only. No imports of runtime gateways, credentials or DB adapters. */
import { createHash } from 'node:crypto';
import type { Assessment, EvidenceBinding, IndependentReview } from './boundaries.js';

// Canonical, flat evidence snapshots only: reject unknown nested values and non-finite numbers.
export function evidenceDigest(payload: Record<string, string | number | boolean>): string {
  const entries = Object.keys(payload).sort().map(key => {
    const value = payload[key];
    if (!['string', 'number', 'boolean'].includes(typeof value) ||
        (typeof value === 'number' && !Number.isSafeInteger(value))) throw Error('INVALID_CANONICAL_EVIDENCE');
    return [key, value];
  });
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}
/** Snapshot must come from an independent trusted collector; fixture acceptance is not certification. */
export function snapshotReview(snapshot: EvidenceBinding & Record<string, unknown>, source: string, reviewer: string): IndependentReview {
  const { payloadSha256: _, ...payload } = snapshot;
  const digest = evidenceDigest(payload as Record<string, string | number | boolean>);
  return { source, reviewer, verify(candidate) {
    const { payloadSha256, ...content } = candidate;
    return payloadSha256 === digest && evidenceDigest(content as Record<string, string | number | boolean>) === digest;
  } };
}
const result = (ok: boolean, reason: string): Assessment => ({ acceptedForReview: ok, reason, executionAuthorized: false });

export type GatewayDrillEvent = {
  requestId: string; provider: 'runpod' | 'vast_ai';
  kind: 'DENIED' | 'RESERVED' | 'INTENT' | 'AMBIGUOUS' | 'RECONCILED_ABSENT' | 'TERMINATED' | 'QUARANTINED';
  costCents?: number;
};
/** Replay a shadow journal, including restart/timeout ambiguity. No event performs dispatch. */
export function assessGatewayDrill(events: readonly GatewayDrillEvent[]): Assessment {
  const states = new Map<string, { provider: string; kind: GatewayDrillEvent['kind'] }>();
  let committedCents = 0;
  const reject = () => result(false, 'OFFLINE_GATEWAY_JOURNAL_INVALID');
  if (!Array.isArray(events) || events.length === 0 || events.length > 1000) return reject();
  for (const event of events) {
    if (!event || !event.requestId?.trim() || !['runpod', 'vast_ai'].includes(event.provider)) return reject();
    const state = states.get(event.requestId);
    if (state && state.provider !== event.provider) return reject();
    if (!state) {
      if (event.kind !== 'DENIED' && event.kind !== 'RESERVED') return reject();
      if (event.kind === 'RESERVED') {
        if (!Number.isSafeInteger(event.costCents) || event.costCents <= 0 || event.costCents > 200 ||
            [...states.values()].some(s => !['DENIED', 'TERMINATED'].includes(s.kind)) ||
            committedCents + event.costCents > 500) return reject();
        committedCents += event.costCents;
      }
    } else {
      const allowed: Partial<Record<GatewayDrillEvent['kind'], string[]>> = {
        RESERVED: ['INTENT', 'QUARANTINED'], INTENT: ['AMBIGUOUS', 'TERMINATED', 'QUARANTINED'],
        AMBIGUOUS: ['RECONCILED_ABSENT', 'TERMINATED', 'QUARANTINED'], RECONCILED_ABSENT: ['INTENT', 'QUARANTINED']
      };
      if (!allowed[state.kind]?.includes(event.kind)) return reject();
    }
    states.set(event.requestId, { provider: event.provider, kind: event.kind });
  }
  return result([...states.values()].every(s => ['DENIED', 'TERMINATED', 'QUARANTINED'].includes(s.kind)),
    'OFFLINE_JOURNAL_ONLY_NO_DISPATCH_AUTHORITY');
}
export function assessDatabaseDrill(proof: {
  isolated: boolean; workers: number; reservations: number; duplicateCredits: number;
  rollbackVerified: boolean; restartVerified: boolean; migrationReplayVerified: boolean;
}): Assessment {
  return result(proof?.isolated === true && Number.isSafeInteger(proof.workers) && proof.workers >= 2 &&
    proof.reservations === 1 && proof.duplicateCredits === 0 && proof.rollbackVerified === true &&
    proof.restartVerified === true && proof.migrationReplayVerified === true, 'OFFLINE_DB_MANIFEST_REQUIRES_INDEPENDENT_EXECUTION_PROOF');
}
