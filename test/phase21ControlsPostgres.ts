import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Pool as PgPool} from 'pg';
import type {Pool} from 'pg';
import {LedgerLab,type LabTransfer} from '../server/phase21/ledgerLab.js';
import {SimulationLeaseStore} from '../server/phase21/workerLease.js';
import {PostgresSimulationGateway} from '../server/phase20/gateway.js';
export async function verifyPhase21Controls(pool:Pool) {
 let passed=0;const check=async(name:string,fn:()=>Promise<void>)=>{await fn();passed++;console.log('PHASE21_CONTROL_PG_PASS '+name);};
 const sql=readFileSync('docs/migration-proposals/20261112_phase21_control_lab.sql','utf8');
 await pool.query(sql);await pool.query(sql);
 await pool.query("INSERT INTO phase21_lab_accounts VALUES ('cash_test0001','owner_test001','USD',10000),('prepaid_test01','owner_test001','USD',0),('foreign_test01','other_test001','USD',100),('zar_test00001','owner_test001','ZAR',100)");
 const ledger=new LedgerLab(pool);const transfer:LabTransfer={eventId:'event_test0001',ownerRef:'owner_test001',currency:'USD',from:'cash_test0001',to:'prepaid_test01',minorUnits:'101'};
 await check('eight concurrent duplicate events post exactly once',async()=>{
  const r=await Promise.all(Array.from({length:8},()=>ledger.transfer(transfer)));assert.equal(r.filter(x=>x.code==='SIMULATED_POSTED').length,1);assert.equal(r.filter(x=>x.code==='REPLAY').length,7);
  assert.equal((await ledger.transfer({...transfer,minorUnits:'102'})).code,'EVENT_CONFLICT');
 });
 await check('negative balance, cross-owner, cross-currency and decimal fail atomically',async()=>{
  for(const changed of [{minorUnits:'99999'},{to:'foreign_test01'},{to:'zar_test00001'},{minorUnits:'1.01'}])assert.notEqual((await ledger.transfer({...transfer,eventId:'negative_test01',...changed})).code,'SIMULATED_POSTED');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM phase21_lab_events')).rows[0].n,1);
 });
 await check('reversal binds original entries and cannot replay under a new event',async()=>{
  const reversal={...transfer,eventId:'reversal_test01',from:transfer.to,to:transfer.from,reversalOf:transfer.eventId};
  assert.equal((await ledger.transfer(reversal)).code,'SIMULATED_POSTED');assert.equal((await ledger.transfer({...reversal,eventId:'reversal_test02'})).code,'TRANSFER_REJECTED');
  assert.equal((await pool.query('SELECT balance::text FROM phase21_lab_accounts WHERE id=$1',[transfer.from])).rows[0].balance,'10000');
 });
 await check('append-only balanced event constraints and transaction rollback',async()=>{
  await assert.rejects(pool.query('DELETE FROM phase21_lab_entries'),/APPEND_ONLY/);
  await assert.rejects(pool.query("INSERT INTO phase21_lab_entries(event_id,account_id,owner_ref,currency,amount) VALUES ('event_test0001','zar_test00001','owner_test001','ZAR',1)"),/UNBALANCED/);
  const c=await pool.connect();try{await c.query('BEGIN');await c.query("INSERT INTO phase21_lab_events(event_id,digest,currency,owner_ref) VALUES ('unbalanced_test',repeat('a',64),'USD','owner_test001')");await assert.rejects(c.query('COMMIT'),/UNBALANCED/);}finally{await c.query('ROLLBACK');c.release();}
 });
 await check('reconstructed ledger replays persisted event and integer conservation',async()=>{
  assert.equal((await new LedgerLab(pool).transfer(transfer)).code,'REPLAY');
  for(let i=0;i<25;i++)assert.equal((await ledger.transfer({...transfer,eventId:'property_event_'+String(i).padStart(3,'0'),minorUnits:String(i+1)})).code,'SIMULATED_POSTED');
  assert.equal((await pool.query("SELECT sum(balance)::text AS n FROM phase21_lab_accounts WHERE owner_ref='owner_test001' AND currency='USD'")).rows[0].n,'10000');
  assert.equal((await pool.query('SELECT sum(amount)::text AS n FROM phase21_lab_entries')).rows[0].n,'0');
 });
 await check('concurrent leases, expiration takeover, stale fence and restart',async()=>{
  const row=(await pool.query("SELECT * FROM phase20_simulation_requests LIMIT 1")).rows[0];assert(row);
  const leases=new SimulationLeaseStore(pool);const r=await Promise.all(['worker_test001','worker_test002'].map(w=>leases.claim(row.id,w,30000)));assert.equal(r.filter(Boolean).length,1);
  const worker=r[0]?'worker_test001':'worker_test002';const first=r.find(Boolean)!;
  assert.equal(await leases.renew(row.id,worker,first),true);
  await pool.query("UPDATE phase21_simulation_leases SET expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[row.id]);
  const second=await new SimulationLeaseStore(pool).claim(row.id,'worker_test003');assert.equal(BigInt(second!),BigInt(first)+1n);
  assert.equal(await leases.renew(row.id,worker,first),false);
  const gateway=new PostgresSimulationGateway(pool);assert.equal((await gateway.transition(row.idempotency_key,'fenced_event01',row.version,'QUARANTINED',undefined,{worker,fence:first})).code,'STALE_WORKER_FENCE');
 });
 await check('disposable pg_dump restore preserves integer journal and evidence receipts',async()=>{
  const url=new URL(process.env.TEST_DATABASE_URL!);const schema=(await pool.query('SELECT current_schema() AS s')).rows[0].s;
  assert.match(schema,/^gpu_test_[a-f0-9]{16}$/);assert.equal(url.hostname,'127.0.0.1');
  const directory=mkdtempSync(join(tmpdir(),'phase21-restore-'));const dump=join(directory,'lab.dump');
  const env={...process.env,PGPASSWORD:decodeURIComponent(url.password)};
  const run=(exe:string,args:string[])=>{const r=spawnSync(exe,args,{env,encoding:'utf8'});assert.equal(r.status,0,exe+' failed; inspect disposable environment');};
  const args=['-h',url.hostname,'-p',url.port,'-U',url.username];const restored='phase21_restore_test';let restorePool:PgPool|undefined;
  try {
   run('pg_dump',[...args,'-Fc','--no-owner','--schema='+schema,'-f',dump,url.pathname.slice(1)]);
   run('createdb',[...args,restored]);run('pg_restore',[...args,'--no-owner','--exit-on-error','-d',restored,dump]);
   url.pathname='/'+restored;restorePool=new PgPool({connectionString:url.href,options:'-c search_path='+schema});
   for(const table of ['phase21_lab_events','phase21_lab_entries','phase21_evidence_receipts']) {
    const original=(await pool.query('SELECT count(*)::int AS n FROM '+table)).rows[0].n;
    assert.equal((await restorePool.query('SELECT count(*)::int AS n FROM '+table)).rows[0].n,original);
   }
   assert.equal((await restorePool.query('SELECT sum(amount)::text AS n FROM phase21_lab_entries')).rows[0].n,'0');
  }finally{await restorePool?.end();run('dropdb',[...args,'--if-exists',restored]);rmSync(directory,{recursive:true,force:true});}
 });
 console.log('PHASE21_CONTROL_POSTGRES_COUNTS '+JSON.stringify({passed,failed:0,skipped:0}));
}
