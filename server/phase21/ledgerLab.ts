import type {Pool} from 'pg';
import {canonicalFacts,reference,sha256} from '../phase20/evidence.js';
export interface LabTransfer {eventId:string;ownerRef:string;currency:'USD'|'ZAR';from:string;to:string;minorUnits:string;reversalOf?:string}
/** Explicitly injected disposable lab. No runtime factory, HTTP route or production posting capability. */
export class LedgerLab {
 constructor(private readonly pool:Pick<Pool,'connect'>){}
 async transfer(input:LabTransfer) {
  const denied=(code:string)=>({code,domain:'SIMULATION',financialExecutionAllowed:false,realRevenueMinorUnits:'0'});
  if(process.env.NODE_ENV!=='test'||process.env.ALLOW_ISOLATED_GPU_DB_TEST!=='YES'||process.env.DATABASE_URL)return denied('LAB_ONLY');
  if(![input.eventId,input.ownerRef,input.from,input.to].every(reference)||input.from===input.to||!['USD','ZAR'].includes(input.currency)||
   !/^[1-9][0-9]{0,15}$/.test(input.minorUnits)||BigInt(input.minorUnits)>9007199254740991n||input.reversalOf!==undefined&&!reference(input.reversalOf))return denied('INVALID_TRANSFER');
  const digest=sha256(canonicalFacts({...input}));let client,committing=false;
  try {
   client=await this.pool.connect();await client.query('BEGIN');await client.query("SET LOCAL lock_timeout='3s'");await client.query("SET LOCAL statement_timeout='5s'");
   // Serialize event replay and account locking consistently, including independent processes.
   await client.query('SELECT pg_advisory_xact_lock($1)',[20261121]);
   const prior=await client.query('SELECT digest FROM phase21_lab_events WHERE event_id=$1',[input.eventId]);
   if(prior.rows.length){await client.query('ROLLBACK');return denied(prior.rows[0].digest===digest?'REPLAY':'EVENT_CONFLICT');}
   if(input.reversalOf){
    const original=await client.query('SELECT e.*, a.account_id,a.amount FROM phase21_lab_events e JOIN phase21_lab_entries a USING(event_id) WHERE event_id=$1',[input.reversalOf]);
    if(original.rows.length!==2||original.rows.some(r=>r.reversal_of||r.owner_ref!==input.ownerRef||r.currency!==input.currency)||
      !original.rows.some(r=>r.account_id===input.from&&BigInt(r.amount)===BigInt(input.minorUnits))||
      !original.rows.some(r=>r.account_id===input.to&&BigInt(r.amount)===-BigInt(input.minorUnits)))throw Error('REVERSAL_BINDING');
   }
   const accounts=await client.query('SELECT * FROM phase21_lab_accounts WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[[input.from,input.to]]);
   if(accounts.rows.length!==2||accounts.rows.some(r=>r.owner_ref!==input.ownerRef||r.currency!==input.currency))throw Error('ACCOUNT_BINDING');
   await client.query('INSERT INTO phase21_lab_events(event_id,digest,currency,owner_ref,reversal_of) VALUES($1,$2,$3,$4,$5)',[input.eventId,digest,input.currency,input.ownerRef,input.reversalOf??null]);
   await client.query('UPDATE phase21_lab_accounts SET balance=balance-$1::bigint WHERE id=$2',[input.minorUnits,input.from]);
   await client.query('UPDATE phase21_lab_accounts SET balance=balance+$1::bigint WHERE id=$2',[input.minorUnits,input.to]);
   await client.query('INSERT INTO phase21_lab_entries(event_id,account_id,owner_ref,currency,amount) VALUES($1,$2,$3,$4,-$5::bigint),($1,$6,$3,$4,$5::bigint)',[input.eventId,input.from,input.ownerRef,input.currency,input.minorUnits,input.to]);
   committing=true;await client.query('COMMIT');return denied('SIMULATED_POSTED');
  }catch {await client?.query('ROLLBACK').catch(()=>undefined);return denied(committing?'OUTCOME_UNKNOWN_RELOAD_EVENT':'TRANSFER_REJECTED');}
  finally{client?.release();}
 }
}
