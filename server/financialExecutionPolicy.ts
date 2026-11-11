/** Pure, fail-closed financial authorization policies. NO provider or payment calls. */
export type Evidence = { id: string; verified: boolean; verifiedAtMs: number; expiresAtMs: number; source: 'trusted_adapter' };
export type PurchaseInput = {
  nowMs: number; jobId: string; ownerApproved: boolean; payment: Evidence; balance: Evidence;
  settledCustomerPaymentCents: number; verifiedAvailableCreditCents: number;
  estimatedCostCents: number; committedTodayCents: number; activePaidJobs: number;
  autoTopupDisabled: boolean; killSwitchVerified: boolean; reservationCommitted: boolean;
};
export type PayoutInput = {
  nowMs: number; payoutId: string; ownerApproved: boolean; settlement: Evidence;
  destination: Evidence; settledProfitCents: number; previouslyPaidCents: number;
  requestedCents: number; duplicatePayoutId: boolean; destinationAllowlisted: boolean;
};
export type Decision = { allowed: boolean; reason: string };
const deny = (reason: string): Decision => ({allowed:false,reason});
const ok = (reason: string): Decision => ({allowed:true,reason});
const cents = (v:number) => Number.isSafeInteger(v) && v >= 0;
const evidenceValid = (e:Evidence | undefined, now:number) => !!e && e.source === 'trusted_adapter' && e.verified === true && /^[A-Za-z0-9_-]{8,120}$/.test(e.id) && Number.isSafeInteger(e.verifiedAtMs) && Number.isSafeInteger(e.expiresAtMs) && e.verifiedAtMs <= now && now < e.expiresAtMs;
export function assessPurchase(i:PurchaseInput):Decision {
  if (!Number.isSafeInteger(i.nowMs) || i.nowMs <= 0) return deny('INVALID_CLOCK');
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(i.jobId)) return deny('INVALID_JOB_ID');
  if (!i.ownerApproved) return deny('OWNER_APPROVAL_REQUIRED');
  if (!evidenceValid(i.payment,i.nowMs)) return deny('PAYMENT_EVIDENCE_UNVERIFIED');
  if (!evidenceValid(i.balance,i.nowMs)) return deny('BALANCE_EVIDENCE_UNVERIFIED');
  if (![i.settledCustomerPaymentCents,i.verifiedAvailableCreditCents,i.estimatedCostCents,i.committedTodayCents,i.activePaidJobs].every(cents)) return deny('INVALID_FINANCIAL_INPUT');
  if (i.estimatedCostCents < 1 || i.estimatedCostCents > 200) return deny('PER_JOB_CAP_EXCEEDED');
  if (i.committedTodayCents + i.estimatedCostCents > 500) return deny('DAILY_CAP_EXCEEDED');
  if (i.activePaidJobs !== 0) return deny('CONCURRENCY_LIMIT');
  if (i.estimatedCostCents > i.verifiedAvailableCreditCents) return deny('INSUFFICIENT_VERIFIED_CREDIT');
  if (i.settledCustomerPaymentCents <= 0 || (i.settledCustomerPaymentCents-i.estimatedCostCents)*100 < i.settledCustomerPaymentCents*30) return deny('MARGIN_TOO_LOW');
  if (!i.autoTopupDisabled) return deny('AUTO_TOPUP_MUST_BE_DISABLED');
  if (!i.killSwitchVerified) return deny('KILL_SWITCH_UNVERIFIED');
  if (!i.reservationCommitted) return deny('DATABASE_RESERVATION_REQUIRED');
  return ok('POLICY_ELIGIBLE_NOT_EXECUTION_AUTHORIZATION');
}
export function assessPayout(i:PayoutInput):Decision {
  if (!Number.isSafeInteger(i.nowMs) || i.nowMs <= 0) return deny('INVALID_CLOCK');
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(i.payoutId)) return deny('INVALID_PAYOUT_ID');
  if (!i.ownerApproved) return deny('OWNER_APPROVAL_REQUIRED');
  if (!evidenceValid(i.settlement,i.nowMs)) return deny('SETTLEMENT_UNVERIFIED');
  if (!evidenceValid(i.destination,i.nowMs) || !i.destinationAllowlisted) return deny('DESTINATION_UNVERIFIED');
  if (![i.settledProfitCents,i.previouslyPaidCents,i.requestedCents].every(cents) || i.requestedCents === 0) return deny('INVALID_PAYOUT_AMOUNT');
  if (i.duplicatePayoutId) return deny('DUPLICATE_PAYOUT');
  if (i.previouslyPaidCents > i.settledProfitCents || i.requestedCents > i.settledProfitCents-i.previouslyPaidCents) return deny('INSUFFICIENT_SETTLED_PROFIT');
  return ok('POLICY_ELIGIBLE_NOT_PAYOUT_AUTHORIZATION');
}
