import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {randomBytes} from 'node:crypto';
import {pgDbService} from '../server/pgDatabase.js';
import {registerReadinessHealth} from '../server/readinessHealth.js';
import {ServiceLifecycle} from '../server/phase21/lifecycle.js';

const fixtureUrl=new URL('postgresql://fixture@database.example/db');fixtureUrl.password='synthetic-password';

test('production readiness independently verifies bootstrap, dependencies and safety',async(t)=>{
 const saved={...process.env};const probe=pgDbService.probeReadiness,connectedFn=pgDbService.isLiveDatabaseConnected;
 const runtime=new ServiceLifecycle();let connected=true,healthy=true;
 Object.assign(process.env,{NODE_ENV:'production',APP_OPERATING_MODE:'DISCOVERY_ONLY',STRICT_AUTH_ENFORCEMENT:'true',RENDER_GIT_COMMIT:'a'.repeat(40),DATABASE_URL:fixtureUrl.href});
 for(const name of ['OWNER_API_KEY','CUSTOMER_API_KEY','ESCROW_SIGNING_SECRET','QUOTE_LOCK_SECRET','AUDIT_CHAIN_SECRET'])process.env[name]=randomBytes(32).toString('hex');
 for(const name of ['DIRECT_URL','POSTGRES_URL','SUPABASE_DB_URL','DB_MIGRATION_EXECUTE','NODE_TLS_REJECT_UNAUTHORIZED','DATABASE_SSL_REJECT_UNAUTHORIZED','ENABLE_STUDIO_AUTH_FALLBACK','ALLOW_PREVIEW_SESSION','GPU_PURCHASING_ENABLED','GPU_EVIDENCE_VERIFIER_READY'])delete process.env[name];
 pgDbService.probeReadiness=async()=>healthy;pgDbService.isLiveDatabaseConnected=()=>connected;
 const app=express();registerReadinessHealth(app,{runtime});const server=app.listen(0,'127.0.0.1');
 await new Promise<void>(r=>server.listening?r():server.once('listening',r));const address=server.address();assert(address&&typeof address!=='string');const base='http://127.0.0.1:'+address.port;
 async function check(expected:number){const r=await fetch(base+'/api/ready');assert.equal(r.status,expected);const body=await r.json();assert.equal(body.revision,'a'.repeat(40));if(expected===200){assert.equal(body.financialExecutionAllowed,false);assert.equal(body.commerciallyCertified,false);}}
 try {
  await t.test('listener alone cannot pass bootstrap',()=>check(503));runtime.complete(true);
  await t.test('verified schema and database pass operational readiness',()=>check(200));
  for(const reason of ['missing schema','TLS verification failure','database outage'])await t.test(reason+' returns 503',async()=>{healthy=false;await check(503);});
  await t.test('recovery requires verification and preserves financial lockdown',async()=>{healthy=true;await check(200);assert.equal(pgDbService.getStatus().liveExecutionAllowed,false);});
  await t.test('unavailable current pool fails despite completed probe',async()=>{connected=false;await check(503);connected=true;});
  await t.test('invalid discovery mode fails despite healthy database',async()=>{process.env.APP_OPERATING_MODE='LIVE';await check(503);process.env.APP_OPERATING_MODE='DISCOVERY_ONLY';});
  await t.test('shutdown returns 503',async()=>{runtime.drain();await check(503);});
 } finally {
  pgDbService.probeReadiness=probe;pgDbService.isLiveDatabaseConnected=connectedFn;
  for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);
  await new Promise<void>(r=>server.close(()=>r()));
 }
});
