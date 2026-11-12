import { integer, reference } from './evidence.js';
export interface TerminationPolicy { resourceId: string; accountId: string; startedAtMs: number; deadlineMs: number; maxCostCents: number; maxRuntimeMs: number }
export interface ResourceObservation {
  origin: 'SIMULATION' | 'INDEPENDENT_READ_ONLY'; resourceId: string; accountId: string;
  observedAtMs: number; providerState: 'RUNNING' | 'STOPPED' | 'UNKNOWN' | 'ABSENT';
  costCents: number; invoiceId: string; invoiceFinal: boolean; continuingCharges: boolean;
  stoppedAtMs: number | null; billedThroughMs: number; cancellationAttempts: number; lastAttemptMs: number | null;
}
export interface TerminationDecision {
  state: 'MONITOR' | 'STOP_REQUIRED' | 'RETRY_STOP' | 'QUARANTINED' | 'SIMULATION_RECONCILED';
  reasons: string[]; humanInterventionRequired: boolean; providerBillingStoppedVerified: false;
  cancellationAuthorized: false; settlementAuthorized: false;
}
/** Decisions only; never calls a real cancellation interface. Unknown observations retain exposure. */
export function assessTermination(p: TerminationPolicy, o: ResourceObservation | null, now=Date.now()): TerminationDecision {
  const decide=(state:TerminationDecision['state'],reason:string,human=true):TerminationDecision=>({state,reasons:[reason],humanInterventionRequired:human,
    providerBillingStoppedVerified:false,cancellationAuthorized:false,settlementAuthorized:false});
  if (!reference(p.resourceId) || !reference(p.accountId) || !integer(now) || !integer(p.startedAtMs) || !integer(p.deadlineMs) ||
      !integer(p.maxRuntimeMs,3600000) || p.maxRuntimeMs<1 || p.deadlineMs<=p.startedAtMs || p.deadlineMs-p.startedAtMs>p.maxRuntimeMs ||
      !integer(p.maxCostCents,200) || p.maxCostCents<1) return decide('QUARANTINED','INVALID_CUTOFF_POLICY');
  if (!o) return decide('QUARANTINED','ORPHAN_OR_MISSING_OBSERVATION');
  if (!['SIMULATION','INDEPENDENT_READ_ONLY'].includes(o.origin) || !['RUNNING','STOPPED','UNKNOWN','ABSENT'].includes(o.providerState) ||
      o.resourceId!==p.resourceId || o.accountId!==p.accountId || !integer(o.observedAtMs) || o.observedAtMs>now || now-o.observedAtMs>300000 ||
      !integer(o.costCents) || !integer(o.cancellationAttempts,3) || !integer(o.billedThroughMs) || o.billedThroughMs>o.observedAtMs ||
      o.billedThroughMs<p.startedAtMs || o.lastAttemptMs!==null && (!integer(o.lastAttemptMs) || o.lastAttemptMs>now)) return decide('QUARANTINED','INVALID_OR_UNBOUND_OBSERVATION');
  if (o.costCents>p.maxCostCents || o.continuingCharges !== false) return decide('QUARANTINED','OVERSPEND_OR_CONTINUING_CHARGES');
  if (o.providerState==='UNKNOWN' || o.providerState==='ABSENT') return decide('QUARANTINED','UNCERTAIN_RESOURCE_OR_ORPHAN');
  if (o.providerState==='STOPPED') {
    if (!integer(o.stoppedAtMs) || o.stoppedAtMs<p.startedAtMs || o.stoppedAtMs>p.deadlineMs || o.stoppedAtMs>o.observedAtMs ||
        o.billedThroughMs>o.stoppedAtMs || !reference(o.invoiceId) || o.invoiceFinal!==true) return decide('QUARANTINED','FINAL_BILLING_RECONCILIATION_REQUIRED');
    return o.origin==='SIMULATION' ? decide('SIMULATION_RECONCILED','SIMULATED_STOP_NOT_PROVIDER_PROOF',false) : decide('QUARANTINED','INDEPENDENT_PROVIDER_INVOICE_VERIFIER_REQUIRED');
  }
  const cutoff = Math.min(p.deadlineMs,p.startedAtMs+p.maxRuntimeMs);
  if (now>=cutoff || o.costCents>=p.maxCostCents) {
    if (o.cancellationAttempts>=3) return decide('QUARANTINED','TERMINATION_RETRIES_EXHAUSTED');
    if (o.lastAttemptMs!==null && now-o.lastAttemptMs<30000) return decide('STOP_REQUIRED','RETRY_BACKOFF');
    return decide(o.cancellationAttempts ? 'RETRY_STOP':'STOP_REQUIRED','COST_OR_RUNTIME_CUTOFF');
  }
  return decide('MONITOR','WITHIN_SIMULATION_LIMITS',false);
}
/** Safe simulation adapter: deterministic, repeatable and incapable of network calls. */
export class SimulationCancellationAdapter {
  readonly simulated = true;
  cancel(resourceId: string, idempotencyKey: string) {
    if (!resourceId.startsWith('sim:') || !reference(resourceId) || !reference(idempotencyKey)) throw Error('SIMULATION_RESOURCE_REQUIRED');
    return {resourceId,idempotencyKey,state:'SIMULATED_STOP_ACKNOWLEDGED',providerBillingStoppedVerified:false as const};
  }
}
export async function cancelRealResource(_resource: unknown) {
  return {allowed:false as const,reason:'SIMULATION_LOCKDOWN_REAL_CANCELLATION_DENIED'};
}
