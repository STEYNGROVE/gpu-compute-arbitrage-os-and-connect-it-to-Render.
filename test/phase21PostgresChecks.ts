import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync,sign} from 'node:crypto';
import type {Pool} from 'pg';
import {EvidenceArchive} from '../server/phase21/evidenceArchive.js';
import {EvidenceAuthority,receiptBytes,type EvidenceReceipt} from '../server/phase20/evidence.js';
import {inspectApplicationSchema} from '../server/phase21/migrations.js';
import {receipt,now} from './phase20Fixtures.js';
export async function verifyPhase21Postgres(pool:Pool) {
  assert.equal(process.env.ALLOW_ISOLATED_GPU_DB_TEST,'YES');assert.equal(process.env.DATABASE_URL,undefined);
  let passed=0;const check=async(name:string,fn:()=>Promise<void>)=>{await fn();passed++;console.log('PHASE21_PG_PASS '+name);};
  const sql=readFileSync('docs/migration-proposals/20261112_phase21_evidence_archive.sql','utf8');
  const keys=generateKeyPairSync('ed25519');const issuer={publicKeyPem:keys.publicKey.export({type:'spki',format:'pem'}).toString(),kinds:['SUPPLIER','PAYMENT'] as const};
  const authority=new EvidenceAuthority(new Map([[receipt.issuer,issuer]]));const archive=new EvidenceArchive(pool,authority);
  const signed=(source:EvidenceReceipt)=>{const r=structuredClone(source);r.payload.origin='INDEPENDENT_READ_ONLY';r.signature=sign(null,Buffer.from(receiptBytes(r)),keys.privateKey).toString('base64');return r;};
  const supplier=signed(receipt);
  const payment=signed({...receipt,payload:{...receipt.payload,kind:'PAYMENT',subjectId:'customer_test01',facts:{orderId:'order_test0001',workloadId:'workload_test01',contractId:'contract_test01',externalEventId:'event_test00001',currency:'USD',amountCents:100,paymentFinal:true,reversed:false}}});
  await check('archive proposal rollback, create and reapply',async()=>{
    const client=await pool.connect();try {await client.query('BEGIN');await client.query(sql);await client.query('ROLLBACK');}finally{client.release();}
    assert.equal((await pool.query("SELECT to_regclass('phase21_evidence_receipts') AS name")).rows[0].name,null);await pool.query(sql);await pool.query(sql);
  });
  await check('concurrent receipt ingestion is durable and idempotent without revenue',async()=>{
    const results=await Promise.all(Array.from({length:8},()=>archive.append(payment,now)));
    assert.equal(results.filter(r=>r.code==='ARCHIVED_FOR_REVIEW').length,1);assert(results.every(r=>['ARCHIVED_FOR_REVIEW','REPLAY'].includes(r.code)));assert(results.every(r=>r.financialPostingPerformed===false));
  });
  let firstDigest:string,secondDigest:string;
  await check('conflicting signed event evidence is retained and quarantines both receipts',async()=>{
    firstDigest=(await archive.append(payment,now)).digest!;
    const altered=signed({...payment,payload:{...payment.payload,facts:{...payment.payload.facts,amountCents:200,orderId:'other_order01'}}});
    const result=await archive.append(altered,now);secondDigest=result.digest!;assert.equal(result.code,'EVENT_CONFLICT_QUARANTINED');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM phase21_evidence_receipts')).rows[0].n,2);
    for(const digest of [firstDigest,secondDigest]){const reviewed=await archive.assessStored(digest,now);assert.equal(reviewed.code,'EVENT_CONFLICT_QUARANTINED');assert.equal(reviewed.assessment!.status,'REJECTED');}
  });
  let supplierDigest:string;
  await check('restart rechecks receipt expiry instead of trusting collection status',async()=>{
    supplierDigest=(await archive.append(supplier,now)).digest!;const restarted=new EvidenceArchive(pool,authority);
    assert.equal((await restarted.assessStored(supplierDigest,now)).assessment!.status,'PARTIALLY_VERIFIED');
    assert.equal((await restarted.assessStored(supplierDigest,now+61000)).assessment!.status,'EXPIRED');
  });
  await check('collector key revocation invalidates archived attestations',async()=>{
    const revoked=new EvidenceAuthority(new Map([[receipt.issuer,{...issuer,revokedAtMs:now}]]));
    assert.equal((await new EvidenceArchive(pool,revoked).assessStored(supplierDigest,now)).assessment!.status,'REJECTED');
  });
  await check('append-only receipts and permanent event conflict reject mutation',async()=>{
    await assert.rejects(pool.query("UPDATE phase21_evidence_receipts SET status_at_collection='VERIFIED'"),/APPEND_ONLY/);
    await assert.rejects(pool.query('DELETE FROM phase21_evidence_receipts'),/APPEND_ONLY/);
    await assert.rejects(pool.query("UPDATE phase21_external_event_bindings SET state='CONSISTENT'"),/IMMUTABLE/);
  });
  await check('credentials or unknown envelope fields reject before SQL',async()=>{
    assert.equal((await archive.append({...supplier,password:'forbidden'} as any,now)).code,'RECEIPT_REJECTED');
    assert.equal((await archive.append({...supplier,payload:{...supplier.payload,facts:{...supplier.payload.facts,apiKey:'forbidden'}}},now)).code,'RECEIPT_REJECTED');
  });
  await check('event-binding failure rolls back new receipt atomically',async()=>{
    await pool.query("CREATE FUNCTION phase21_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_FAILURE'; END; $$");
    await pool.query('CREATE TRIGGER phase21_test_failure BEFORE INSERT ON phase21_external_event_bindings FOR EACH ROW EXECUTE FUNCTION phase21_test_failure()');
    const failed=signed({...payment,payload:{...payment.payload,facts:{...payment.payload.facts,externalEventId:'new_event00001'}}});
    const before=(await pool.query('SELECT count(*)::int AS n FROM phase21_evidence_receipts')).rows[0].n;
    assert.equal((await archive.append(failed,now)).code,'ARCHIVE_OUTCOME_UNKNOWN_RELOAD_DIGEST');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM phase21_evidence_receipts')).rows[0].n,before);
    await pool.query('DROP TRIGGER phase21_test_failure ON phase21_external_event_bindings');await pool.query('DROP FUNCTION phase21_test_failure()');
  });
  await check('read-only compatibility checks detect wrong column types',async()=>{
    assert.equal((await inspectApplicationSchema(pool as any)).compatible,true);
    const client=await pool.connect();try {await client.query('BEGIN');await client.query('ALTER TABLE acquisition_leads ALTER COLUMN published_at TYPE text');
      const result=await inspectApplicationSchema(client);assert.equal(result.compatible,false);assert(result.missing.includes('acquisition_leads.published_at'));await client.query('ROLLBACK');
    } finally {client.release();}
    assert.equal((await inspectApplicationSchema(pool as any)).compatible,true);
  });
  console.log('PHASE21_POSTGRES_COUNTS '+JSON.stringify({passed,failed:0,skipped:0}));
}
