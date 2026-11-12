import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {registerPhase20Readiness} from '../server/phase20/routes.js';
import {quote,request} from './phase20Fixtures.js';
process.env.NODE_ENV='test';process.env.DISABLE_JSON_PERSISTENCE='true';process.env.STRICT_AUTH_ENFORCEMENT='true';
process.env.OWNER_API_KEY='phase20-synthetic-owner-key-only';delete process.env.DATABASE_URL;
const {requireOwnerAuth,createBrowserSession}=await import('../server/auth.js');
const app=express();app.use(express.json({limit:'64kb'}));registerPhase20Readiness(app,requireOwnerAuth);
const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.listening?resolve():server.once('listening',resolve));
const address=server.address();assert(address && typeof address!=='string');const base=`http://127.0.0.1:${address.port}`;
const owner={'X-Owner-Api-Key':process.env.OWNER_API_KEY,'Content-Type':'application/json'};
const originalFetch=globalThis.fetch;
globalThis.fetch=(async(input:any,init?:any)=>{if(!String(input).startsWith(base+'/'))throw Error('EXTERNAL_HTTP_FORBIDDEN');return originalFetch(input,init);}) as typeof fetch;
after(async()=>{globalThis.fetch=originalFetch;await new Promise<void>(resolve=>server.close(()=>resolve()));});
for(const path of ['readiness','gateway-preview','quote-preview']) test(`owner RBAC protects Phase 20 ${path}`,async()=>{
  const method=path==='readiness'?'GET':'POST';const customer=createBrowserSession('CUSTOMER','buyer');
  for(const headers of [{},{'X-Owner-Api-Key':'invalid'},{'X-Session-Id':customer.sessionId}]) assert.equal((await fetch(base+'/api/owner/phase20/'+path,{method,headers})).status,403);
});
test('owner readiness reports blockers and no connected production journal',async()=>{
  const response=await fetch(base+'/api/owner/phase20/readiness',{headers:owner});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const body=await response.json() as any;assert.equal(body.remainingBlockers,5);assert.equal(body.productionJournalConnected,false);assert.equal(body.execution.allowed,false);assert.equal(body.realizedRevenueCents,0);
});
test('real gateway preview always denies and simulation preview never writes',async()=>{
  for(const mode of ['REAL','SIMULATION']) {
    const response=await fetch(base+'/api/owner/phase20/gateway-preview',{method:'POST',headers:owner,body:JSON.stringify({...request,mode})});
    assert.equal(response.status,200);const body=await response.json() as any;assert.equal(body.executionAuthorized,false);assert.equal(body.realMoneyMovedCents,0);
  }
});
test('quote preview requires bounded explicit evidence and cannot establish payment or capacity',async()=>{
  const fresh={...quote,supplier:{...quote.supplier,observedAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()}};
  const response=await fetch(base+'/api/owner/phase20/quote-preview',{method:'POST',headers:owner,body:JSON.stringify(fresh)});
  assert.equal(response.status,200);const body=await response.json() as any;assert.equal(body.quote.purchasingAllowed,false);assert.equal(body.quote.paymentVerified,false);assert.equal(body.quote.capacityVerified,false);assert.equal(body.quote.realizedRevenueCents,0);
  const bad=await fetch(base+'/api/owner/phase20/quote-preview',{method:'POST',headers:owner,body:JSON.stringify({...fresh,supplier:{...fresh.supplier,sourceUrl:'http://localhost/secret-token'}})});
  assert.equal(bad.status,400);assert(!(await bad.text()).includes('secret-token'));
});
test('oversized owner requests rejected before model assessment',async()=>{
  assert.equal((await fetch(base+'/api/owner/phase20/gateway-preview',{method:'POST',headers:owner,body:JSON.stringify({padding:'x'.repeat(33000)})})).status,413);
});
test('owner endpoints retain a bounded request rate',async()=>{
  let limited=false;for(let i=0;i<35;i++){const response=await fetch(base+'/api/owner/phase20/readiness',{headers:owner});if(response.status===429){limited=true;break;}}
  assert(limited);
});
