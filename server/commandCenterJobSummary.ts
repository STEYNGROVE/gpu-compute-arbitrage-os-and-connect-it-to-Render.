/** Read-only job exposure. Accrued telemetry is never invoice or realized-profit evidence. */
type Job = {id: string; gpuCount?: number; currentAccruedCost?: number; status: string};
type StoredJob = {jobId: string; gpuCount: number; actualCost?: number; status: string};
/**
 * Reconcile memory telemetry with PostgreSQL job states without authorizing execution.
 * Database state wins for job identity/status; memory retains its accrued estimates.
 * Counts and accrued totals are unknown without PostgreSQL, and incomplete estimates,
 * invoiced costs and realized profit are never reported as verified financial results.
 */
export async function commandCenterJobSummary(memory: Job[], connected: boolean, load: (memoryJobIds: string[]) => Promise<StoredJob[]>) {
  const jobs = new Map(memory.map(job => [job.id, job]));
  let authoritative = false;
  if (connected) {
    const stored = await load(memory.map(job => job.id)); // A read error must fail the HTTP request, not fabricate a zero count.
    for (const job of stored) jobs.set(job.jobId, {id:job.jobId,gpuCount:job.gpuCount,currentAccruedCost:jobs.get(job.jobId)?.currentAccruedCost ?? job.actualCost,status:job.status});
    authoritative = true;
  }
  const active = [...jobs.values()].filter(job => ['RUNNING','PROVISIONING','VERIFYING','UNSETTLED_NEEDS_RECONCILIATION'].includes(job.status));
  return {
    activeJobs: active,
    count: authoritative ? active.length : null,
    gpuCount: authoritative ? active.reduce((n, job) => n + (job.gpuCount || 0), 0) : null,
    status: authoritative ? (active.length ? 'RUNNING' : 'STANDBY') : 'UNKNOWN',
    source: authoritative ? 'POSTGRES_AND_MEMORY' : 'MEMORY_ONLY_UNVERIFIED',
    estimatedAccruedCost: authoritative && active.every(job => Number.isFinite(job.currentAccruedCost) && job.currentAccruedCost! >= 0)
      ? active.reduce((n, job) => n + job.currentAccruedCost!, 0) : null,
    invoicedCostUsd: null,
    realizedProfitUsd: null
  };
}
