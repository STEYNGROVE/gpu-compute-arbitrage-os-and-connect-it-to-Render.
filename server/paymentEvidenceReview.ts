/** Phase 9.4: read-only reconciliation of evidence returned by an independently
 * authenticated provider adapter. This module NEVER fetches provider data,
 * verifies provider authenticity, credits balances, or authorizes spending.
 */
export type ExpectedPayment = {orderId:string;customerId:string;provider:string;currency:string;amountMinor:number;expiresAt:string};
export type ProviderObservation = {orderId:string;customerId:string;provider:string;currency:string;amountMinor:number;transactionId:string;status:string;observedAt:string;authenticatedByProvider:boolean;independentlyFetched:boolean};
export type EvidenceDecision = {accepted:false;reason:string;readOnly:true;procurementBlocked:true};
const reject=(reason:string):EvidenceDecision=>({accepted:false,reason,readOnly:true,procurementBlocked:true});
/** Deliberately rejects all inputs for authorization. Returns an audit reason. */
export function reviewPaymentEvidence(expected:ExpectedPayment, observed:ProviderObservation, now:Date=new Date()):EvidenceDecision {
 if (!expected || !observed) return reject('MISSING_EVIDENCE');
 if (!observed.authenticatedByProvider || !observed.independentlyFetched) return reject('PROVIDER_AUTHENTICITY_UNVERIFIED');
 if (![expected.orderId,expected.customerId,expected.provider,expected.currency,observed.transactionId].every(x=>typeof x==='string' && x.length>0 && x.length<=200)) return reject('INVALID_IDENTITY');
 if (observed.orderId!==expected.orderId || observed.customerId!==expected.customerId || observed.provider!==expected.provider) return reject('ORDER_CUSTOMER_PROVIDER_MISMATCH');
 if (observed.currency!==expected.currency) return reject('CURRENCY_MISMATCH');
 if (!Number.isSafeInteger(expected.amountMinor) || expected.amountMinor<=0 || !Number.isSafeInteger(observed.amountMinor) || observed.amountMinor!==expected.amountMinor) return reject('AMOUNT_MISMATCH');
 const expiry=Date.parse(expected.expiresAt), observedAt=Date.parse(observed.observedAt);
 if (!Number.isFinite(expiry) || !Number.isFinite(observedAt) || !Number.isFinite(now.getTime()) || observedAt>now.getTime()+300000 || now.getTime()>=expiry) return reject('EXPIRED_OR_INVALID_TIME');
 if (observed.status!=='SETTLED') return reject('PAYMENT_NOT_SETTLED');
 // No durable unique transaction allocation ledger is integrated yet.
 return reject('REPLAY_PROTECTION_NOT_INTEGRATED');
}
