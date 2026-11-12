import {EvidenceAuthority,reference,integer,type EvidenceReceipt} from '../phase20/evidence.js';
export interface PaymentOrder {customerId:string;accountId:string;contractId:string;orderId:string;currency:'USD'|'ZAR';amountMinorUnits:number}
/** Future boundary, no webhook route, signer, transport, ledger or payment collection installed. */
export function reviewPaymentEvent(receipt:EvidenceReceipt,order:PaymentOrder,authority:EvidenceAuthority,now=Date.now()) {
 const assessment=authority.assess(receipt,'PAYMENT',order.customerId,order.accountId,now);const f=receipt?.payload?.facts;
 const valid=assessment.status==='VERIFIED'&&[order.contractId,order.orderId].every(reference)&&['USD','ZAR'].includes(order.currency)&&integer(order.amountMinorUnits)&&order.amountMinorUnits>0&&
  f?.contractId===order.contractId&&f?.orderId===order.orderId&&f?.currency===order.currency&&f?.amountCents===order.amountMinorUnits&&reference(f?.externalEventId)&&f?.paymentFinal===true&&f?.reversed===false;
 return {status:valid?'REQUIRES_DURABLE_EVENT_DEDUPLICATION':'REJECTED',assessment,collectionAllowed:false,postingAllowed:false,recognitionAllowed:false};
}
