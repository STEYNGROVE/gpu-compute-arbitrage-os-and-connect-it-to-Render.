import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import type {Pool,PoolClient} from 'pg';
import {PostgresSimulationGateway} from '../server/phase20/gateway.js';
import {request} from './phase20Fixtures.js';

/** Supplied by the disposable harness only. This function never discovers a database target. */
export async function verifyPhase20Postgres(pool:Pool) {
  assert.equal(process.env.ALLOW_ISOLATED_GPU_DB_TEST,'YES');assert.equal(process.env.DATABASE_URL,undefined);
  let passed=0;
  const check=async(name:string,fn:()=>Promise<void>)=>{await fn();passed++;console.log('PHASE20_PG_PASS '+name);};
  const sql=readFileSync('docs/migration-proposals/20261112_phase20_simulation_journal.sql','utf8');
  const observedPool={query:pool.query.bind(pool),connect:async()=>{
    const client=await pool.connect(),query=client.query.bind(client);
    return {query:async(sql:string,args?:unknown[])=>{try{return await query(sql,args);}catch(error){console.log('PHASE20_SQLSTATE '+(error as {code?:string}).code+' '+sql.split(/\s+/).slice(0,3).join(' '));throw error;}},release:()=>client.release()} as unknown as PoolClient;
  }} as unknown as Pool;
  const gateway=new PostgresSimulationGateway(observedPool);
  const key=(s:string)=>'phase20_request_'+s;
  const cancel=async(k:string)=>{const r=(await gateway.load(k)).record!;assert.equal((await gateway.transition(k,'cancel_event0001',r.version,'CANCELLED')).code,'SIMULATION_TRANSITION_RECORDED');};
  await check('transactional migration rollback and reapply',async()=>{
    const client=await pool.connect();try {await client.query('BEGIN');await client.query(sql);await client.query('ROLLBACK');}finally{client.release();}
    assert.equal((await pool.query("SELECT to_regclass('phase20_simulation_requests') AS name")).rows[0].name,null);
    await pool.query(sql);await pool.query(sql);
  });
  await check('same-key concurrency produces one durable reservation',async()=>{
    const results=await Promise.all(Array.from({length:8},()=>gateway.reserve(request)));
    assert.equal(results.filter(r=>r.code==='SIMULATION_RESERVED').length,1);
    assert(results.every(r=>['SIMULATION_RESERVED','REPLAY'].includes(r.code)),JSON.stringify(results.map(r=>r.code)));
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM phase20_simulation_requests')).rows[0].n,1);
  });
  await check('payload mismatch cannot reuse idempotency key',async()=>{
    assert.equal((await gateway.reserve({...request,maxCostCents:100})).code,'IDEMPOTENCY_CONFLICT');
    assert.equal((await gateway.reserve({...request,idempotencyKey:key('blocked')})).code,'SIMULATION_CONCURRENCY_LIMIT');
  });
  await check('restart reconstructs reservation and original evidence digest',async()=>{
    const restarted=new PostgresSimulationGateway(pool);
    assert.equal((await restarted.load(request.idempotencyKey)).record!.state,'SIMULATION_RESERVED');
    assert.equal((await restarted.recoverOutstanding()).length,1);assert.equal(await restarted.audit(request.idempotencyKey),true);
  });
  await check('duplicate transition is idempotent and audit-linked',async()=>{
    const first=await gateway.transition(request.idempotencyKey,'cancel_test0001',1,'CANCELLED');
    assert.equal(first.code,'SIMULATION_TRANSITION_RECORDED');
    assert.equal((await gateway.transition(request.idempotencyKey,'cancel_test0001',1,'CANCELLED')).code,'REPLAY');
    assert.equal((await gateway.transition(request.idempotencyKey,'cancel_test0001',1,'QUARANTINED')).code,'IDEMPOTENCY_CONFLICT');
    assert.equal(await gateway.audit(request.idempotencyKey),true);
  });
  await check('database blocks authorization, request mutation and audit rewrites',async()=>{
    await assert.rejects(pool.query('UPDATE phase20_simulation_requests SET execution_authorized=true'));
    await assert.rejects(pool.query("UPDATE phase20_simulation_requests SET max_cost_cents=1"));
    await assert.rejects(pool.query("UPDATE phase20_simulation_events SET kind='forged'"),/APPEND_ONLY/);
    await assert.rejects(pool.query('DELETE FROM phase20_simulation_events'),/APPEND_ONLY/);
    await assert.rejects(pool.query('DELETE FROM phase20_simulation_requests'),/APPEND_ONLY/);
  });
  const schema=(await pool.query('SELECT current_schema() AS name')).rows[0].name;
  assert.match(schema,/^gpu_test_[a-f0-9]{16}$/);
  const worker=(mode:string,k:string)=>new Promise<{status:number|null;code?:string}>((resolve,reject)=>{
    const child=spawn(process.execPath,['--import','tsx','test/phase20GatewayWorker.ts'],{env:{...process.env,PHASE20_TEST_SCHEMA:schema,PHASE20_WORKER_MODE:mode,PHASE20_REQUEST_KEY:k},stdio:['ignore','pipe','pipe']});
    let output='';child.stdout.on('data',b=>{output+=b;});
    // stderr stays local and is intentionally not echoed (connection targets must not leak).
    child.stderr.resume();child.on('error',()=>reject(Error('ISOLATED_WORKER_START_FAILED')));
    child.on('close',status=>{try {resolve({status,...(status===0?JSON.parse(output.trim()):{})});}catch{reject(Error('INVALID_WORKER_RESULT'));}});
  });
  await check('independent processes serialize active reservations',async()=>{
    const results=await Promise.all([worker('RESERVE',key('process_a')),worker('RESERVE',key('process_b'))]);
    assert(results.every(r=>r.status===0));assert.equal(results.filter(r=>r.code==='SIMULATION_RESERVED').length,1);
    assert.equal(results.filter(r=>r.code==='SIMULATION_CONCURRENCY_LIMIT').length,1);
    const active=(await gateway.recoverOutstanding())[0].record;await cancel(active.idempotency_key);
  });
  await check('process death before COMMIT rolls back reservation and audit atomically',async()=>{
    assert.equal((await worker('CRASH',key('crash'))).status,17);
    assert.equal((await gateway.load(key('crash'))).code,'NOT_FOUND');
    assert.equal((await gateway.reserve({...request,idempotencyKey:key('after_crash')})).code,'SIMULATION_RESERVED');
    await cancel(key('after_crash'));
  });
  await check('lost COMMIT acknowledgement returns uncertainty and reload prevents duplication',async()=>{
    let once=true;
    const wrapped={query:pool.query.bind(pool),connect:async()=>{
      const client=await pool.connect();const query=client.query.bind(client);
      return {query:async(sql:string,args?:unknown[])=>{const r=await query(sql,args);if(sql==='COMMIT' && once){once=false;throw Error('SIMULATED_LOST_ACK');}return r;},release:()=>client.release()} as unknown as PoolClient;
    }} as unknown as Pool;
    const result=await new PostgresSimulationGateway(wrapped).reserve({...request,idempotencyKey:key('lost_ack')});
    assert.equal(result.code,'OUTCOME_UNKNOWN_RELOAD_IDEMPOTENCY_KEY');
    assert.equal((await gateway.reserve({...request,idempotencyKey:key('lost_ack')})).code,'REPLAY');await cancel(key('lost_ack'));
  });
  await check('failed audit insert rolls back state and reservation',async()=>{
    await pool.query("CREATE FUNCTION phase20_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_FAILURE'; END; $$");
    await pool.query('CREATE TRIGGER phase20_test_failure BEFORE INSERT ON phase20_simulation_events FOR EACH ROW EXECUTE FUNCTION phase20_test_fail()');
    assert.equal((await gateway.reserve({...request,idempotencyKey:key('rollback')})).code,'SIMULATION_STORE_UNAVAILABLE');
    assert.equal((await gateway.load(key('rollback'))).code,'NOT_FOUND');
    await pool.query('DROP TRIGGER phase20_test_failure ON phase20_simulation_events');await pool.query('DROP FUNCTION phase20_test_fail()');
  });
  await check('deferred constraint rejects state without matching audit event',async()=>{
    await gateway.reserve({...request,idempotencyKey:key('cutoff')});
    await assert.rejects(pool.query("UPDATE phase20_simulation_requests SET state='SIMULATION_RUNNING',version=version+1 WHERE idempotency_key=$1",[key('cutoff')]),/ATOMIC_AUDIT_REQUIRED/);
    assert.equal((await gateway.load(key('cutoff'))).record!.state,'SIMULATION_RESERVED');
  });
  await check('restart persists stop intent, retry backoff and unresolved billing exposure',async()=>{
    assert.equal((await gateway.transition(key('cutoff'),'running_event01',1,'SIMULATION_RUNNING')).code,'SIMULATION_TRANSITION_RECORDED');
    const stopped=await gateway.transition(key('cutoff'),'stop_event00001',2,'STOP_REQUIRED');assert.equal(stopped.record!.cancellation_attempts,1);
    const restarted=new PostgresSimulationGateway(pool);
    assert.equal((await restarted.transition(key('cutoff'),'stop_retry00001',3,'STOP_REQUIRED')).code,'SIMULATION_STOP_BACKOFF');
    assert.equal((await restarted.transition(key('cutoff'),'reconcile_event',3,'SIMULATION_RECONCILED')).code,'BILLING_RECONCILIATION_REQUIRED');
    const row=stopped.record!;const stoppedAt=Math.min(Number(row.deadline_ms),Date.now());
    const reconciliation=await restarted.transition(key('cutoff'),'reconcile_proof',3,'SIMULATION_RECONCILED',{
      origin:'SIMULATION',resourceId:'sim:'+row.id,accountId:request.accountId,observedAtMs:Date.now(),providerState:'STOPPED',costCents:100,
      invoiceId:'sim_invoice0001',invoiceFinal:true,continuingCharges:false,stoppedAtMs:stoppedAt,billedThroughMs:stoppedAt,cancellationAttempts:1,lastAttemptMs:Number(row.last_attempt_ms)
    });
    assert.equal(reconciliation.code,'SIMULATION_TRANSITION_RECORDED');assert.equal(await restarted.audit(key('cutoff')),true);
  });
  await check('expired reservation cannot start after restart',async()=>{
    const k=key('expired_start');
    assert.equal((await gateway.reserve({...request,idempotencyKey:k,maxRuntimeMs:1})).code,'SIMULATION_RESERVED');
    await new Promise(resolve=>setTimeout(resolve,5));
    const restarted=new PostgresSimulationGateway(pool);
    assert.equal((await restarted.transition(k,'expired_start01',1,'SIMULATION_RUNNING')).code,'SIMULATION_DEADLINE_EXPIRED');
    assert.equal((await restarted.recoverOutstanding())[0].nextStep,'CUTOFF_REVIEW_REQUIRED');
    await cancel(k);
  });
  await check('daily budget retains reconciled exposure without reusing real balances',async()=>{
    assert.equal((await gateway.reserve({...request,idempotencyKey:key('budget_b'),maxCostCents:200})).code,'SIMULATION_RESERVED');
    // Journaled stop + quarantine keep exposure locked; cancellation is permitted only before running.
    await gateway.transition(key('budget_b'),'budget_cancel01',1,'CANCELLED');
    assert.equal((await gateway.reserve({...request,idempotencyKey:key('budget_c'),maxCostCents:200})).code,'SIMULATION_RESERVED');
    const active=(await gateway.load(key('budget_c'))).record!;
    await gateway.transition(key('budget_c'),'budget_run0001',active.version,'SIMULATION_RUNNING');
    await gateway.transition(key('budget_c'),'budget_stop001',active.version+1,'STOP_REQUIRED');
    const row=(await gateway.load(key('budget_c'))).record!;
    const time=Date.now();
    await gateway.transition(key('budget_c'),'budget_proof001',row.version,'SIMULATION_RECONCILED',{
      origin:'SIMULATION',resourceId:'sim:'+row.id,accountId:request.accountId,observedAtMs:time,providerState:'STOPPED',costCents:100,
      invoiceId:'sim_invoice0002',invoiceFinal:true,continuingCharges:false,stoppedAtMs:time,billedThroughMs:time,cancellationAttempts:1,lastAttemptMs:Number(row.last_attempt_ms)
    });
    assert.equal((await gateway.reserve({...request,idempotencyKey:key('over_daily'),maxCostCents:200})).code,'SIMULATION_DAILY_CAP');
    assert.equal((await pool.query('SELECT sum(real_money_moved_cents)::int AS cents FROM phase20_simulation_requests')).rows[0].cents,0);
  });
  console.log('PHASE20_POSTGRES_COUNTS '+JSON.stringify({passed,failed:0,skipped:0}));
}
