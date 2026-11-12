import type { Pool } from 'pg';
import {EvidenceAuthority,receiptBytes,sha256,canonicalFacts,reference,type EvidenceReceipt} from '../phase20/evidence.js';
const allowedFacts=new Set(['resourceId','startedAtMs','stoppedAtMs','billedThroughMs','finalCostCents','invoiceId','resourcesAbsent','releaseRevision','requirement','offerId','gpuModel','gpuCount','vramGb','totalHourlyCents','balanceCents','currency','available','billingMode','autoChargeDisabled','termsReference',
  'orderId','workloadId','contractId','amountCents','identityValidated','procurementValidated','contactValidated','contractState','customerApproved','invoiceFinal','paymentFinal',
  'reversed','externalEventId','customerAccepted','finalCostsReconciled','continuingCharges','revenuePolicyApproved']);
export const archiveDigest=(receipt:EvidenceReceipt)=>sha256(canonicalFacts({payloadDigest:sha256(receiptBytes(receipt)),signature:receipt.signature}));
const kinds=['SUPPLIER','CUSTOMER_IDENTITY','REQUIREMENT','CONTACT','CONTRACT','APPROVAL','QUOTE','INVOICE','PAYMENT','DELIVERY','BILLING'];
/** Injected store only; never constructed with ambient production credentials by application startup.
 * Stores normalized receipts, not raw provider responses/credentials. Conflicting events retain both receipts.
 */
export class EvidenceArchive {
  constructor(private readonly pool:Pick<Pool,'connect'|'query'>,private readonly authority:EvidenceAuthority=new EvidenceAuthority()){}
  async append(receipt:EvidenceReceipt,now=Date.now()) {
    let digest:string,eventKey:string|null=null,status:string;
    try {
      if(Object.keys(receipt).some(k=>!['issuer','signature','payload'].includes(k)) || Object.keys(receipt.payload).some(k=>!['kind','subjectId','accountId','origin','sourceUrl','observedAt','expiresAt','facts'].includes(k)) || !kinds.includes(receipt.payload.kind) || typeof receipt.signature!=='string' || receipt.signature.length>128)throw Error('INVALID_ENVELOPE');
      if(Object.keys(receipt.payload.facts).some(k=>!allowedFacts.has(k)))throw Error('UNSUPPORTED_FACT');
      const assessment=this.authority.assess(receipt,receipt.payload.kind,receipt.payload.subjectId,receipt.payload.accountId,now);
      if(assessment.status==='REJECTED')throw Error('INVALID_RECEIPT');
      digest=archiveDigest(receipt);status=assessment.status;
      if(assessment.signatureVerified && receipt.payload.kind==='PAYMENT' && receipt.payload.origin==='INDEPENDENT_READ_ONLY') {
        if(!reference(receipt.payload.facts.externalEventId))throw Error('INVALID_EVENT_REFERENCE');
        eventKey=sha256(canonicalFacts({issuer:receipt.issuer,eventId:receipt.payload.facts.externalEventId}));
      }
      if(Buffer.byteLength(JSON.stringify(receipt))>32768)throw Error('RECEIPT_LIMIT');
    } catch {return {code:'RECEIPT_REJECTED',financialPostingPerformed:false};}
    let client;
    try {
      client=await this.pool.connect();await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout='5s'");await client.query("SET LOCAL lock_timeout='3s'");
      const inserted=await client.query('INSERT INTO phase21_evidence_receipts(digest,receipt,status_at_collection) VALUES($1,$2,$3) ON CONFLICT(digest) DO NOTHING RETURNING digest',[digest,JSON.stringify(receipt),status]);
      let eventState='NOT_APPLICABLE';
      if(eventKey){const binding=await client.query(`INSERT INTO phase21_external_event_bindings(event_key,first_digest,state) VALUES($1,$2,'CONSISTENT')
        ON CONFLICT(event_key) DO UPDATE SET state=CASE WHEN phase21_external_event_bindings.first_digest=EXCLUDED.first_digest THEN phase21_external_event_bindings.state ELSE 'CONFLICTED' END RETURNING state`,[eventKey,digest]);eventState=binding.rows[0].state;}
      await client.query('COMMIT');
      return {code:eventState==='CONFLICTED'?'EVENT_CONFLICT_QUARANTINED':inserted.rows.length?'ARCHIVED_FOR_REVIEW':'REPLAY',digest,eventState,financialPostingPerformed:false};
    } catch {await client?.query('ROLLBACK').catch(()=>undefined);return {code:'ARCHIVE_OUTCOME_UNKNOWN_RELOAD_DIGEST',digest,financialPostingPerformed:false};}
    finally{client?.release();}
  }
  async assessStored(digest:string,now=Date.now()) {
    if(!/^[a-f0-9]{64}$/.test(digest))return {code:'INVALID_DIGEST',financialPostingPerformed:false};
    try {
      const result=await this.pool.query('SELECT receipt FROM phase21_evidence_receipts WHERE digest=$1',[digest]);
      if(!result.rows[0])return {code:'NOT_FOUND',financialPostingPerformed:false};
      const receipt=result.rows[0].receipt as EvidenceReceipt;
      if(archiveDigest(receipt)!==digest)return {code:'CORRUPTED_RECEIPT',financialPostingPerformed:false};
      const assessment=this.authority.assess(receipt,receipt.payload.kind,receipt.payload.subjectId,receipt.payload.accountId,now);
      const eventKey=receipt.payload.kind==='PAYMENT' && typeof receipt.payload.facts.externalEventId==='string'
        ?sha256(canonicalFacts({issuer:receipt.issuer,eventId:receipt.payload.facts.externalEventId})):'';
      const conflicts=await this.pool.query("SELECT state FROM phase21_external_event_bindings WHERE event_key=$1 AND state='CONFLICTED'",[eventKey]);
      return {code:conflicts.rows.length?'EVENT_CONFLICT_QUARANTINED':'REASSESSED',assessment:conflicts.rows.length?{...assessment,status:'REJECTED',reasons:['PAYMENT_EVENT_CONFLICT']}:assessment,financialPostingPerformed:false};
    } catch {return {code:'ARCHIVE_UNAVAILABLE',financialPostingPerformed:false};}
  }
}
