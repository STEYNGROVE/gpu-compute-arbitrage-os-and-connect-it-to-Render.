import { EvidenceAuthority, integer, type EvidenceKind, type EvidenceReceipt } from './evidence.js';
export const revenueStages = ['PROJECTED_REVENUE','QUOTED_REVENUE','CONTRACTED_REVENUE','INVOICED_REVENUE','PAYMENT_VERIFIED','REALIZED_REVENUE'] as const;
export type RevenueStage = typeof revenueStages[number];
const requirements: Record<RevenueStage,readonly EvidenceKind[]> = {
  PROJECTED_REVENUE:[], QUOTED_REVENUE:['CUSTOMER_IDENTITY','REQUIREMENT','CONTACT','QUOTE'],
  CONTRACTED_REVENUE:['CONTRACT','APPROVAL'], INVOICED_REVENUE:['INVOICE'],
  PAYMENT_VERIFIED:['PAYMENT'], REALIZED_REVENUE:['DELIVERY','BILLING']
};
export interface CommercialEvidenceChain { customerId: string; accountId: string; orderId: string; workloadId: string; contractId: string; amountCents: number; receipts: Partial<Record<EvidenceKind,EvidenceReceipt>> }
/** Explicit requested transition, never automatic progression. Records no ledger entry or invoice. */
export function evaluateRevenueTransition(current: RevenueStage, target: RevenueStage, chain: CommercialEvidenceChain, authority: EvidenceAuthority, now = Date.now()) {
  const reasons: string[]=[];
  const from=revenueStages.indexOf(current),to=revenueStages.indexOf(target);
  if (from<0 || to!==from+1 || !integer(chain.amountCents) || chain.amountCents<1) reasons.push('INVALID_REVENUE_TRANSITION');
  if (!reasons.length) {
    const kinds=revenueStages.slice(0,to+1).flatMap(stage=>requirements[stage]);
    for (const kind of kinds) {
      const receipt=chain.receipts[kind];
      const f=receipt?.payload?.facts;
      if (!receipt || authority.assess(receipt,kind,chain.customerId,chain.accountId,now).status!=='VERIFIED' ||
          !f || f.orderId!==chain.orderId || f.workloadId!==chain.workloadId || f.contractId!==chain.contractId ||
          f.currency!=='USD' || f.amountCents!==chain.amountCents) {reasons.push(kind+'_INDEPENDENT_EVIDENCE_REQUIRED');continue;}
      if (kind==='CUSTOMER_IDENTITY' && f.identityValidated!==true || kind==='REQUIREMENT' && f.procurementValidated!==true ||
          kind==='CONTACT' && f.contactValidated!==true || kind==='CONTRACT' && f.contractState!=='SIGNED' ||
          kind==='APPROVAL' && f.customerApproved!==true || kind==='INVOICE' && f.invoiceFinal!==true ||
          kind==='PAYMENT' && (f.paymentFinal!==true || f.reversed!==false || typeof f.externalEventId!=='string' || !f.externalEventId.trim()) ||
          kind==='DELIVERY' && f.customerAccepted!==true || kind==='BILLING' && (f.finalCostsReconciled!==true || f.continuingCharges!==false || f.revenuePolicyApproved!==true)) reasons.push(kind+'_FACTS_INSUFFICIENT');
    }
  }
  return {current,target,allowedForEvidenceRecording:reasons.length===0,reasons,
    // Evaluation is not a posting or authorization to collect/recognize money.
    financialPostingPerformed:false,realizedRevenuePostedCents:0,executionAuthorized:false};
}
