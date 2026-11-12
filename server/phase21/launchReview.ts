import {EvidenceAuthority,type EvidenceReceipt,type EvidenceKind,reference} from '../phase20/evidence.js';
export const launchRequirements=['CONFIGURATION','SCHEMA_BASELINE','RESTORE_REHEARSAL','SUPPLIER_ACCOUNT','SUPPLIER_CAPACITY','BILLING_CUTOFF','CUSTOMER_CONTRACT','PAYMENT_LIFECYCLE','FINANCIAL_AUDIT','SECURITY_AUDIT'] as const;
export type LaunchRequirement=typeof launchRequirements[number];
const kind:Record<LaunchRequirement,EvidenceKind>={CONFIGURATION:'APPROVAL',SCHEMA_BASELINE:'APPROVAL',RESTORE_REHEARSAL:'APPROVAL',SUPPLIER_ACCOUNT:'SUPPLIER',SUPPLIER_CAPACITY:'SUPPLIER',BILLING_CUTOFF:'BILLING',CUSTOMER_CONTRACT:'CONTRACT',PAYMENT_LIFECYCLE:'PAYMENT',FINANCIAL_AUDIT:'APPROVAL',SECURITY_AUDIT:'APPROVAL'};
/** Review dossier only. Caller flags, test outcomes and CI badges are not independent launch proof. */
export function reviewLaunchEvidence(revision:string,subjectId:string,accountId:string,receipts:Partial<Record<LaunchRequirement,EvidenceReceipt>>,authority:EvidenceAuthority,now=Date.now()) {
  const missing:string[]=[];
  if(!/^[a-f0-9]{40}$/.test(revision)||!reference(subjectId)||!reference(accountId))missing.push('INVALID_RELEASE_BINDING');
  for(const requirement of launchRequirements) {
    const receipt=receipts[requirement];
    if(!receipt || authority.assess(receipt,kind[requirement],subjectId,accountId,now).status!=='VERIFIED' ||
       receipt.payload.facts.releaseRevision!==revision || receipt.payload.facts.requirement!==requirement)missing.push(requirement);
  }
  return {eligibleForIndependentHumanReview:!missing.length,missing,activationAllowed:false,deploymentAllowed:false,financialExecutionAllowed:false,
    separateReviewedAuthorizationRequired:true};
}
