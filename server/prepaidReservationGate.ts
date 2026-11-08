import type { Pool, PoolClient } from 'pg';
import { assessCreditJob, type CreditJob } from './creditSpendPolicy.js';

/** This is a reservation primitive, NOT a purchasing authorization.
 * Evidence must be independently verified by a trusted payment/provider adapter.
 * Never accept CreditJob evidence flags directly from an HTTP client.
 */
export type ReservationRequest = {
  jobId: string;
  customerPaymentEvidenceId: string;
  providerBalanceEvidenceId: string;
  ownerApprovalEvidenceId: string;
  job: CreditJob;
};
export type ReservationDecision = { reserved: boolean; reason: string; reservationId?: string };
const MAX_DAILY_CENTS = 500;
const MAX_JOB_CENTS = 200;
function cents(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('INVALID_AMOUNT');
  const n = Math.round(value * 100);
  if (!Number.isSafeInteger(n) || Math.abs(n / 100 - value) > 0.000001) throw new Error('INVALID_AMOUNT_PRECISION');
  return n;
}
export async function reservePrepaidCredit(pool: Pool, req: ReservationRequest): Promise<ReservationDecision> {
  if (process.env.GPU_PURCHASING_ENABLED !== 'true') return { reserved: false, reason: 'PURCHASING_DISABLED' };
  // Intentionally no live-execution pathway until evidence verification and cancellation are integrated.
  if (process.env.GPU_EVIDENCE_VERIFIER_READY !== 'true') return { reserved: false, reason: 'EVIDENCE_VERIFIER_NOT_READY' };
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(req.jobId || '')) return { reserved: false, reason: 'INVALID_JOB_ID' };
  if (![req.customerPaymentEvidenceId,req.providerBalanceEvidenceId,req.ownerApprovalEvidenceId].every(v=>typeof v==='string' && /^[a-zA-Z0-9_-]{8,120}$/.test(v))) return { reserved: false, reason: 'EVIDENCE_REQUIRED' };
  // Merely having evidence IDs does not establish validity; fail closed until a verifier is injected.
  return { reserved: false, reason: 'EXTERNAL_EVIDENCE_VERIFICATION_NOT_IMPLEMENTED' };
}

/** Internal reservation transaction. Only invoke after trusted evidence verification.
 * Requires migration 20261108_prepaid_reservations.sql and a live verified balance.
 */
export async function reserveVerifiedCredit(
  pool: Pool, req: ReservationRequest, verifiedBalanceCents: number,
  verifiedCustomerPaymentCents: number
): Promise<ReservationDecision> {
  if (process.env.GPU_PURCHASING_ENABLED !== 'true') return {reserved:false,reason:'PURCHASING_DISABLED'};
  if (process.env.GPU_EVIDENCE_VERIFIER_READY !== 'true') return {reserved:false,reason:'EVIDENCE_VERIFIER_NOT_READY'};
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(req.jobId || '')) return {reserved:false,reason:'INVALID_JOB_ID'};
  if (![req.customerPaymentEvidenceId,req.providerBalanceEvidenceId,req.ownerApprovalEvidenceId].every(v=>typeof v==='string' && /^[a-zA-Z0-9_-]{8,120}$/.test(v))) return {reserved:false,reason:'EVIDENCE_REQUIRED'};
  if (!Number.isSafeInteger(verifiedBalanceCents) || verifiedBalanceCents < 0 || !Number.isSafeInteger(verifiedCustomerPaymentCents) || verifiedCustomerPaymentCents <= 0) return {reserved:false,reason:'INVALID_VERIFIED_EVIDENCE'};
  let cost: number;
  try { cost=cents(req.job.estimatedGpuCostUsd); } catch { return {reserved:false,reason:'INVALID_AMOUNT'}; }
  if (cost < 1 || cost > MAX_JOB_CENTS) return {reserved:false,reason:'PER_JOB_CAP_EXCEEDED'};
  const c: PoolClient = await pool.connect();
  try {
    await c.query('BEGIN');
    // Serialize all reservations globally across replicas and concurrent requests.
    await c.query('SELECT pg_advisory_xact_lock($1)',[20261108]);
    const prior=await c.query('SELECT id FROM gpu_prepaid_reservations WHERE job_id=$1',[req.jobId]);
    if (prior.rowCount) {await c.query('ROLLBACK');return {reserved:false,reason:'DUPLICATE_JOB'};}
    const daily=await c.query("SELECT COALESCE(SUM(estimated_cost_cents),0)::int AS total FROM gpu_prepaid_reservations WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AND status IN ('RESERVED','RUNNING','SETTLED')");
    const active=await c.query("SELECT COUNT(*)::int AS total FROM gpu_prepaid_reservations WHERE status IN ('RESERVED','RUNNING')");
    const outstanding=await c.query("SELECT COALESCE(SUM(estimated_cost_cents),0)::int AS total FROM gpu_prepaid_reservations WHERE provider=$1 AND status IN ('RESERVED','RUNNING')",[req.job.provider]);
    const dailyCents=Number(daily.rows[0].total),activeCount=Number(active.rows[0].total),outstandingCents=Number(outstanding.rows[0].total);
    if (dailyCents+cost>MAX_DAILY_CENTS) {await c.query('ROLLBACK');return {reserved:false,reason:'DAILY_CAP_EXCEEDED'};}
    if (activeCount!==0) {await c.query('ROLLBACK');return {reserved:false,reason:'CONCURRENCY_LIMIT'};}
    if (outstandingCents+cost>verifiedBalanceCents) {await c.query('ROLLBACK');return {reserved:false,reason:'INSUFFICIENT_VERIFIED_CREDIT'};}
    const decision=assessCreditJob({...req.job,customerPaymentUsd:verifiedCustomerPaymentCents/100,availablePrepaidCreditUsd:(verifiedBalanceCents-outstandingCents)/100,todayCommittedUsd:dailyCents/100,concurrentPaidJobs:activeCount});
    if (!decision.allowed) {await c.query('ROLLBACK');return {reserved:false,reason:decision.reason};}
    const inserted=await c.query("INSERT INTO gpu_prepaid_reservations (job_id,provider,estimated_cost_cents,customer_payment_evidence_id,provider_balance_evidence_id,owner_approval_evidence_id,status) VALUES ($1,$2,$3,$4,$5,$6,'RESERVED') RETURNING id",[req.jobId,req.job.provider,cost,req.customerPaymentEvidenceId,req.providerBalanceEvidenceId,req.ownerApprovalEvidenceId]);
    await c.query('COMMIT');
    return {reserved:true,reason:'RESERVED_NOT_EXECUTION_AUTHORIZATION',reservationId:String(inserted.rows[0].id)};
  } catch {try {await c.query('ROLLBACK');} catch {} return {reserved:false,reason:'DATABASE_RESERVATION_FAILED'};}
  finally {c.release();}
}
