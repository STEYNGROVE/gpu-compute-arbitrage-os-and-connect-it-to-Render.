/** Offline assessment only. These contracts cannot authorize reservations or external actions. */
export type EvidenceBinding = {
  id: string;
  subjectId: string;
  accountId: string;
  observedAtMs: number;
  expiresAtMs: number;
  payloadSha256: string;
};
export type IndependentReview = {
  source: string;
  reviewer: string;
  /** Must verify the exact canonical payload, subject, account and freshness, not caller flags. */
  verify: (evidence: EvidenceBinding) => boolean;
};
export type Assessment = { acceptedForReview: boolean; reason: string; executionAuthorized: false };
const decision = (reason: string, acceptedForReview = false): Assessment => ({ acceptedForReview, reason, executionAuthorized: false });

function reviewed(e: EvidenceBinding, subjectId: string, accountId: string, now: number, review: IndependentReview): boolean {
  if (!e || !review || !review.source || !review.reviewer || review.source === review.reviewer ||
      !e.id || e.subjectId !== subjectId || e.accountId !== accountId || !subjectId || !accountId ||
      !/^[a-f0-9]{64}$/.test(e.payloadSha256) || !Number.isSafeInteger(now) ||
      !Number.isSafeInteger(e.observedAtMs) || !Number.isSafeInteger(e.expiresAtMs) ||
      e.observedAtMs > now || now - e.observedAtMs > 300_000 || e.expiresAtMs <= now ||
      e.observedAtMs < 0 || e.expiresAtMs - e.observedAtMs > 300_000 ||
      e.expiresAtMs <= e.observedAtMs) return false;
  try { return review.verify(e) === true; } catch { return false; }
}
const money = (n: number) => Number.isSafeInteger(n) && n >= 0;

export type SupplierEvidence = EvidenceBinding & {
  provider: 'runpod' | 'vast_ai'; currency: 'USD'; balanceCents: number;
  billingMode: 'PREPAID'; autoChargeDisabled: boolean;
};
export function assessSupplierEvidence(e: SupplierEvidence, provider: string, accountId: string, now: number, review: IndependentReview): Assessment {
  if (!e || !['runpod', 'vast_ai'].includes(provider) || e.provider !== provider ||
      e.currency !== 'USD' || !money(e.balanceCents) || e.billingMode !== 'PREPAID' ||
      e.autoChargeDisabled !== true || !reviewed(e, provider, accountId, now, review)) return decision('SUPPLIER_EVIDENCE_UNVERIFIED');
  return decision('SUPPLIER_EVIDENCE_REVIEWED_NOT_SPEND_AUTHORITY', true);
}

export type PaymentEvidence = EvidenceBinding & {
  customerId: string; rail: 'BINANCE'; currency: 'USD'; amountCents: number;
  externalEventId: string; state: 'FINAL' | 'PENDING' | 'REVERSED';
};
/** Replay prevention and ledger credit must occur atomically in a future certified DB adapter. */
export function assessPrepaidPayment(e: PaymentEvidence, orderId: string, customerId: string, accountId: string, expectedCents: number, now: number, review: IndependentReview): Assessment {
  if (!e || !customerId || e.customerId !== customerId || e.rail !== 'BINANCE' || e.currency !== 'USD' ||
      !money(expectedCents) || expectedCents === 0 || e.amountCents !== expectedCents ||
      typeof e.externalEventId !== 'string' || !e.externalEventId.trim() || e.externalEventId.length > 200 || e.state !== 'FINAL' || !reviewed(e, orderId, accountId, now, review)) return decision('PAYMENT_EVIDENCE_UNVERIFIED');
  return decision('PAYMENT_REVIEWED_REPLAY_AND_LEDGER_CERTIFICATION_REQUIRED', true);
}

export type TerminationEvidence = EvidenceBinding & {
  instanceId: string; providerState: 'TERMINATED' | 'RUNNING' | 'UNKNOWN';
  startedAtMs: number; stoppedAtMs: number; finalCostCents: number;
  invoiceId: string; invoiceFinal: boolean;
};
/** An acknowledged stop is insufficient: missing, late or conflicting evidence quarantines funds. */
export function reconcileTermination(e: TerminationEvidence, instanceId: string, accountId: string, maxCostCents: number, deadlineMs: number, now: number, review: IndependentReview): Assessment {
  if (!e || !reviewed(e, instanceId, accountId, now, review) || e.instanceId !== instanceId ||
      e.providerState !== 'TERMINATED' || typeof e.invoiceId !== 'string' || !e.invoiceId.trim() || e.invoiceId.length > 200 || e.invoiceFinal !== true ||
      !money(e.finalCostCents) || !money(maxCostCents) || e.finalCostCents > maxCostCents ||
      !Number.isSafeInteger(deadlineMs) || !Number.isSafeInteger(e.startedAtMs) || !Number.isSafeInteger(e.stoppedAtMs) ||
      e.startedAtMs < 0 || e.stoppedAtMs < e.startedAtMs || e.stoppedAtMs > deadlineMs ||
      e.stoppedAtMs > e.observedAtMs) return decision('QUARANTINE_RECONCILIATION_REQUIRED');
  return decision('TERMINATION_REVIEWED_NO_SETTLEMENT_AUTHORITY', true);
}

/** The proposed gateway deliberately has no provider, database or payment adapter dependency. */
export async function requestPurchase(_request: unknown): Promise<Assessment> {
  return decision('SIMULATION_LOCKDOWN_PURCHASING_GATEWAY_NOT_CERTIFIED');
}
