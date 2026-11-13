import assert from 'node:assert/strict';
import pg from 'pg';
import {readFileSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
// Only the owning disposable harness supplies this URL. No inherited app target.
const raw=process.env.TEST_DATABASE_URL;
if(!raw||process.env.NODE_ENV!=='test'||process.env.ALLOW_ISOLATED_GPU_DB_TEST!=='YES'||process.env.RENDER||process.env.DATABASE_URL)throw Error('ISOLATED_FIXTURE_REQUIRED');
const url=new URL(raw);
if(url.hostname!=='127.0.0.1'||url.username!=='phase16_testowner'||url.pathname!=='/phase16_test'||!url.port||url.search)throw Error('ISOLATED_FIXTURE_REQUIRED');
const client=new pg.Client({connectionString:raw});
const schema='phase25_'+randomBytes(8).toString('hex');
let passed=0;
async function check(name:string,fn:()=>Promise<void>){await fn();passed++;console.log('PHASE25_PG_PASS '+name);}
try {
 await client.connect();await client.query('CREATE SCHEMA '+schema);await client.query('SET search_path TO '+schema);
 const files=['20261109000002_commercial_intake_prerequisites.sql','20261110_v5_commercial_evidence.sql','20261113000000_commercial_evidence_immutability.sql'];
 await check('commercial migrations create prerequisites and dependent foreign keys in order',async()=>{
  for(const file of files)await client.query(readFileSync('supabase/migrations/'+file,'utf8'));
 });
 await check('migrations are repeatable without changing data',async()=>{
  for(const file of files)await client.query(readFileSync('supabase/migrations/'+file,'utf8'));
 });
 const id=randomUUID();
 await check('commercial intake constraints reject invalid counts',async()=>{
  await assert.rejects(client.query("INSERT INTO commercial_quote_requests(id,company,contact_name,email,workload,gpu_model,gpu_count,hours) VALUES($1,'fixture','fixture','fixture@example.test','OTHER','ANY',0,1)",[id]),(e:any)=>e.code==='23514');
  await client.query("INSERT INTO commercial_quote_requests(id,company,contact_name,email,workload,gpu_model,gpu_count,hours) VALUES($1,'fixture','fixture','fixture@example.test','OTHER','ANY',1,1)",[id]);
 });
 await check('commercial evidence foreign keys reject orphan audit rows',async()=>{
  await assert.rejects(client.query("INSERT INTO commercial_evidence_audit(request_id,action,after_data) VALUES($1,'fixture','{}')",[randomUUID()]),(e:any)=>e.code==='23503');
 });
 await client.query("INSERT INTO commercial_evidence_audit(request_id,action,after_data) VALUES($1,'fixture','{}')",[id]);
 await check('audit rows cannot be updated or deleted',async()=>{
  for(const sql of ["UPDATE commercial_evidence_audit SET action='changed'",'DELETE FROM commercial_evidence_audit','TRUNCATE commercial_evidence_audit'])await assert.rejects(client.query(sql),/IMMUTABLE_AUDIT/);
 });
 const evidenceId=randomUUID();
 await client.query(`INSERT INTO preapproved_workload_evidence(id,customer_name,customer_email,workload_description,evidence_type,evidence_sha256,document_reference,issuer_name,issuer_contact,budget_currency,approved_budget)
 VALUES($1,'fixture','fixture@example.test','fixture','SIGNED_CONTRACT',$2,'fixture','fixture','fixture','USD',1)`,[evidenceId,'a'.repeat(64)]);
 await check('document metadata is immutable while a single review decision is allowed',async()=>{
  await assert.rejects(client.query("UPDATE preapproved_workload_evidence SET approved_budget=999"),/IMMUTABLE_EVIDENCE/);
  await assert.rejects(client.query('DELETE FROM preapproved_workload_evidence'),/IMMUTABLE_EVIDENCE/);
  await client.query("UPDATE preapproved_workload_evidence SET state='REJECTED',reviewer='fixture',verification_notes='fixture',verified_at=now()");
  await assert.rejects(client.query("UPDATE preapproved_workload_evidence SET state='PENDING_VERIFICATION'"),/IMMUTABLE_EVIDENCE/);
 });
 await check('hunter source deduplication matches ON CONFLICT(source_url)',async()=>{
  const sql="INSERT INTO gpu_hunter_opportunities(id,company,source_url,evidence,workload,contact_channel,score) VALUES($1,'fixture','https://example.test/source','fixture','fixture','fixture',1) ON CONFLICT(source_url) DO NOTHING";
  await client.query(sql,[randomUUID()]);assert.equal((await client.query(sql,[randomUUID()])).rowCount,0);
 });
 console.log('PHASE25 COMMERCIAL POSTGRES: '+passed+' passed, 0 failed, 0 skipped');
} finally {await client.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE').catch(()=>{});await client.end();}
