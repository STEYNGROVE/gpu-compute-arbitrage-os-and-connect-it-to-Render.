/** Read-only job exposure. Accrued telemetry is never invoice or realized-profit evidence. */
type Job = {id: string; gpuCount?: number; currentAccruedCost?: number; status: string};
type StoredJob = {jobId: string; gpuCount: number; actualCost?: number; status: string};
export async function commandCenterJobSummary(memory: Job[], connected: boolean, load: () => Promise<StoredJob[]>) {
  const jobs = new Map(memory.map(job => [job.id, job]));
  let authoritative = false;
  if (connected) {
    const stored = await load(); // A read error must fail the HTTP request, not fabricate a zero count.
    for (const job of stored) jobs.set(job.jobId, {id:job.jobId,gpuCount:job.gpuCount,currentAccruedCost:job.actualCost,status:job.status});
    authoritative = true;
  }
  const active = [...jobs.values()].filter(job => ['RUNNING','PROVISIONING','VERIFYING','UNSETTLED_NEEDS_RECONCILIATION'].includes(job.status));
  return {
    activeJobs: active,
    count: authoritative ? active.length : null,
    gpuCount: authoritative ? active.reduce((n, job) => n + (job.gpuCount || 0), 0) : null,
    status: authoritative ? (active.length ? 'RUNNING' : 'STANDBY') : 'UNKNOWN',
    source: authoritative ? 'POSTGRES_AND_MEMORY' : 'MEMORY_ONLY_UNVERIFIED',
    estimatedAccruedCost: active.reduce((n, job) => n + (Number.isFinite(job.currentAccruedCost) && job.currentAccruedCost! >= 0 ? job.currentAccruedCost! : 0),0),
    invoicedCostUsd: null,
    realizedProfitUsd: null
  };
}
