/** Decision support only: never calls a provider or enables provisioning. */
export type CreditJob = {
  provider: 'vast_ai' | 'runpod';
  customerPaymentVerified: boolean;
  customerPaymentUsd: number;
  estimatedGpuCostUsd: number;
  availablePrepaidCreditUsd: number;
  todayCommittedUsd: number;
  concurrentPaidJobs: number;
  cardAutoTopupDisabled: boolean;
  ownerApproved: boolean;
};
export type CreditDecision = { allowed: boolean; reason: string };
export function assessCreditJob(job: CreditJob): CreditDecision {
  const deny = (reason: string): CreditDecision => ({ allowed: false, reason });
  if (!job.ownerApproved) return deny('OWNER_APPROVAL_REQUIRED');
  if (!job.customerPaymentVerified) return deny('CUSTOMER_PAYMENT_UNVERIFIED');
  if (!job.cardAutoTopupDisabled) return deny('AUTO_TOPUP_MUST_BE_DISABLED');
  if (![job.customerPaymentUsd, job.estimatedGpuCostUsd, job.availablePrepaidCreditUsd, job.todayCommittedUsd].every(Number.isFinite)) return deny('INVALID_FINANCIAL_INPUT');
  if (job.estimatedGpuCostUsd <= 0 || job.customerPaymentUsd <= 0 || job.availablePrepaidCreditUsd < 0 || job.todayCommittedUsd < 0) return deny('INVALID_FINANCIAL_INPUT');
  if (job.estimatedGpuCostUsd > 2) return deny('PER_JOB_CAP_EXCEEDED');
  if (job.todayCommittedUsd + job.estimatedGpuCostUsd > 5) return deny('DAILY_CAP_EXCEEDED');
  if (job.concurrentPaidJobs !== 0) return deny('CONCURRENCY_LIMIT');
  if (job.estimatedGpuCostUsd > job.availablePrepaidCreditUsd) return deny('INSUFFICIENT_PREPAID_CREDIT');
  if ((job.customerPaymentUsd - job.estimatedGpuCostUsd) / job.customerPaymentUsd < 0.30) return deny('MARGIN_TOO_LOW');
  return { allowed: true, reason: 'POLICY_ELIGIBLE_ONLY_NOT_EXECUTION_AUTHORIZATION' };
}
