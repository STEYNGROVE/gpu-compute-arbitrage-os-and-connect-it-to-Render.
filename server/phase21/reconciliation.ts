import {strictPublicationTimestamp} from '../publicationTimestamp.js';
import {EvidenceAuthority,integer,type EvidenceReceipt} from '../phase20/evidence.js';
export function reviewIndependentBilling(receipt:EvidenceReceipt,policy:{resourceId:string;accountId:string;deadlineMs:number;startedAtMs:number;maxCostCents:number},authority:EvidenceAuthority,now=Date.now()) {
  const review=authority.assess(receipt,'BILLING','resource:'+policy.resourceId,policy.accountId,now);
  const f=receipt?.payload?.facts;
  const accepted=review.status==='VERIFIED' && f && f.resourceId===policy.resourceId &&
    integer(policy.maxCostCents,200) && policy.maxCostCents>0 && integer(policy.startedAtMs) && integer(policy.deadlineMs) && policy.deadlineMs>policy.startedAtMs && policy.deadlineMs-policy.startedAtMs<=3600000 &&
    integer(f.finalCostCents) && f.finalCostCents<=policy.maxCostCents && integer(f.stoppedAtMs) && f.stoppedAtMs>=policy.startedAtMs && f.stoppedAtMs<=policy.deadlineMs && f.stoppedAtMs<=strictPublicationTimestamp(receipt.payload.observedAt) &&
    integer(f.billedThroughMs) && f.billedThroughMs>=policy.startedAtMs && f.billedThroughMs<=f.stoppedAtMs &&
    f.invoiceFinal===true && typeof f.invoiceId==='string' && f.invoiceId.trim().length>0 &&
    f.resourcesAbsent===true && f.continuingCharges===false;
  return {status:accepted?'INDEPENDENT_EVIDENCE_REVIEW_REQUIRED':'QUARANTINED',assessment:review,humanInterventionRequired:true,
    providerTerminationIssued:false,settlementAllowed:false,financialExecutionAllowed:false};
}
/** Always-on release latch: restart begins engaged, and this release has no disarm capability. */
export class EmergencyStopLatch {
  private reason='INITIAL_LOCKDOWN';private engagements=0;
  engage(reason:'OPERATOR'|'COST_LIMIT'|'RUNTIME_LIMIT'|'UNKNOWN_PROVIDER_STATE') {
    if(!['OPERATOR','COST_LIMIT','RUNTIME_LIMIT','UNKNOWN_PROVIDER_STATE'].includes(reason))throw Error('INVALID_EMERGENCY_REASON');
    this.reason=reason;this.engagements++;return this.snapshot();
  }
  snapshot(){return {engaged:true,reason:this.reason,engagements:this.engagements,financialExecutionAllowed:false,providerTerminationIssued:false};}
  requestDisengage(){return {allowed:false,reason:'SEPARATE_REVIEWED_RELEASE_REQUIRED'};}
}
export const releaseEmergencyStop=new EmergencyStopLatch();
