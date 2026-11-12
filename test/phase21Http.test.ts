import {safeRequestErrorHandler} from '../server/phase21/observability.js';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {registerReadinessHealth} from '../server/readinessHealth.js';
import {ServiceLifecycle} from '../server/phase21/lifecycle.js';
import {registerPhase21Readiness} from '../server/phase21/routes.js';
import {pgDbService} from '../server/pgDatabase.js';
process.env.NODE_ENV='test';process.env.DISABLE_JSON_PERSISTENCE='true';process.env.STRICT_AUTH_ENFORCEMENT='true';process.env.OWNER_API_KEY='phase21-synthetic-owner-key-only';delete process.env.DATABASE_URL;
const {requireOwnerAuth,createBrowserSession}=await import('../server/auth.js');
const originalConnected=pgDbService.isLiveDatabaseConnected,originalQuery=pgDbService.query;
let calls=0,resolveProbe:((value:unknown)=>void)|undefined,mode='OK';
pgDbService.isLiveDatabaseConnected=()=>true;
pgDbService.query=(async()=>{calls++;if(mode==='HANG')return new Promise(resolve=>{resolveProbe=resolve;});if(mode==='FAIL')throw Error('PRIVATE_DATABASE_DETAIL');return {rows:[]};}) as any;
const runtime=new ServiceLifecycle();const app=express();registerReadinessHealth(app,{runtime,timeoutMs:20});registerPhase21Readiness(app,requireOwnerAuth);
app.post('/parser-fixture',express.json({limit:'1kb'}),(_req,res)=>res.json({ok:true}));app.use(safeRequestErrorHandler);
const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.listening?resolve():server.once('listening',resolve));const address=server.address();assert(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}`;
after(async()=>{pgDbService.isLiveDatabaseConnected=originalConnected;pgDbService.query=originalQuery;await new Promise<void>(resolve=>server.close(()=>resolve()));});
test('readiness cannot pass before bootstrap even when database is connected',async()=>{assert.equal((await fetch(base+'/api/ready')).status,503);assert.equal(calls,0);runtime.complete(true);assert.equal((await fetch(base+'/api/ready')).status,200);});
test('hung readiness probes are bounded and coalesced, then recover',async()=>{
  mode='HANG';const before=calls;const responses=await Promise.all([fetch(base+'/api/ready'),fetch(base+'/api/ready')]);assert(responses.every(r=>r.status===503));assert.equal(calls-before,1);
  resolveProbe!({rows:[]});await new Promise(resolve=>setTimeout(resolve,0));mode='OK';assert.equal((await fetch(base+'/api/ready')).status,200);
});
test('query failure and draining fail closed without leaking error content',async()=>{
  mode='FAIL';const response=await fetch(base+'/api/ready');assert.equal(response.status,503);assert(!(await response.text()).includes('PRIVATE_DATABASE_DETAIL'));mode='OK';runtime.drain();assert.equal((await fetch(base+'/api/ready')).status,503);
});
test('Phase 21 readiness requires actual owner role and reveals no secrets',async()=>{
  const customer=createBrowserSession('CUSTOMER','buyer');for(const headers of [{},{'X-Owner-Api-Key':'invalid'},{'X-Session-Id':customer.sessionId}])assert.equal((await fetch(base+'/api/owner/phase21/readiness',{headers})).status,403);
  const response=await fetch(base+'/api/owner/phase21/readiness',{headers:{'X-Owner-Api-Key':process.env.OWNER_API_KEY!}});assert.equal(response.status,200);const body=await response.text();assert(!body.includes(process.env.OWNER_API_KEY!));assert.equal(JSON.parse(body).financialExecutionAllowed,false);assert.equal(response.headers.get('cache-control'),'no-store');
});

test('emergency engagement requires owner and never issues provider termination',async()=>{
  const path=base+'/api/owner/phase21/emergency-stop';assert.equal((await fetch(path,{method:'POST'})).status,403);
  const response=await fetch(path,{method:'POST',headers:{'X-Owner-Api-Key':process.env.OWNER_API_KEY!,'Content-Type':'application/json'},body:JSON.stringify({reason:'OPERATOR'})});
  assert.equal(response.status,200);const body=await response.json() as any;assert.equal(body.engaged,true);assert.equal(body.providerTerminationIssued,false);assert.equal(body.financialExecutionAllowed,false);
});

test('malformed JSON responses and logs cannot echo submitted secrets',async()=>{
  const response=await fetch(base+'/parser-fixture',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"private":"PRIVATE_TOKEN"'});
  assert.equal(response.status,400);const body=await response.text();assert(!body.includes('PRIVATE_TOKEN'));assert.equal(JSON.parse(body).error,'INVALID_JSON');
});
