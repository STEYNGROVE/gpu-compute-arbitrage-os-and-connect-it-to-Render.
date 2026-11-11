import assert from 'node:assert/strict';
import express from 'express';
import { commandCenterJobSummary } from '../server/commandCenterJobSummary.js';
process.env.NODE_ENV='test';process.env.DISABLE_JSON_PERSISTENCE='true';
process.env.STRICT_AUTH_ENFORCEMENT='true';process.env.OWNER_API_KEY='review-synthetic-owner-secret';
delete process.env.DATABASE_URL;
const {verifiedOwnerRateIdentity}=await import('../server/ownerRateIdentity.js');
const {rateLimit}=await import('../server/rateLimit.js');
const {requireOwnerAuth,createBrowserSession,revokeBrowserSession}=await import('../server/auth.js');
const summary=await commandCenterJobSummary([{id:'same',gpuCount:1,currentAccruedCost:100,status:'RUNNING'}],true,async()=>[
 {jobId:'same',gpuCount:2,actualCost:3,status:'RUNNING'}, {jobId:'pg-only',gpuCount:4,actualCost:7,status:'PROVISIONING'}]);
assert.equal(summary.count,2);assert.equal(summary.gpuCount,6);assert.equal(summary.estimatedAccruedCost,107);
const reconciled=await commandCenterJobSummary([
 {id:'stale',gpuCount:8,currentAccruedCost:50,status:'RUNNING'},
 {id:'memory-only',gpuCount:1,currentAccruedCost:2,status:'RUNNING'},
 {id:'estimate',gpuCount:2,currentAccruedCost:100,status:'RUNNING'}
],true,async ids=>{
 assert(ids.includes('stale'));
 return [{jobId:'stale',gpuCount:8,status:'COMPLETED'}, {jobId:'estimate',gpuCount:2,status:'RUNNING'}];
});
assert.equal(reconciled.count,2);assert.equal(reconciled.gpuCount,3);assert.equal(reconciled.estimatedAccruedCost,102);
const unknown=await commandCenterJobSummary([],true,async()=>[{jobId:'missing-estimate',gpuCount:1,status:'RUNNING'}]);
assert.equal(unknown.estimatedAccruedCost,null,'Missing telemetry is not zero cost');
assert.equal(summary.invoicedCostUsd,null);assert.equal(summary.realizedProfitUsd,null);
assert.equal((await commandCenterJobSummary([],false,async()=>{throw Error('not called');})).count,null);
await assert.rejects(commandCenterJobSummary([],true,async()=>{throw Error('unavailable');}));
const app=express();app.use(express.json());app.use(rateLimit(2,60000,1,undefined,verifiedOwnerRateIdentity));
app.get('/public',(_q,r)=>r.json({ok:true}));app.get('/owner',requireOwnerAuth,(_q,r)=>r.json({ok:true}));
app.post('/api/auth/login',(q,r)=>r.status(verifiedOwnerRateIdentity(q)?200:403).json({}));
const listener=app.listen(0,'127.0.0.1');await new Promise<void>(r=>listener.listening?r():listener.once('listening',r));
const address=listener.address();assert(address&&typeof address!=='string');const url=`http://127.0.0.1:${address.port}`;
try {
 for(let i=0;i<3;i++) assert.equal((await fetch(url+'/public',{headers:{'X-Forwarded-For':`1.2.3.${i}`}})).status,i<2?200:429);
 const customer=createBrowserSession('CUSTOMER','test');
 assert.equal((await fetch(url+'/owner',{headers:{'X-Session-Id':customer.sessionId}})).status,429);
 const owner=createBrowserSession('OWNER');revokeBrowserSession(owner.sessionId);
 assert.equal((await fetch(url+'/owner',{headers:{'X-Session-Id':owner.sessionId}})).status,429);
 assert.equal((await fetch(url+'/owner',{headers:{'X-Owner-Api-Key':process.env.OWNER_API_KEY}})).status,200);
 assert.equal((await fetch(url+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'OWNER',secretOrKey:process.env.OWNER_API_KEY})})).status,200);
 assert.equal((await fetch(url+'/owner',{headers:{'X-Owner-Api-Key':process.env.OWNER_API_KEY}})).status,429,'Verified owners remain rate limited');
} finally {await new Promise<void>(r=>listener.close(()=>r()));}
console.log('PASS: authoritative job deduplication, unverified cost/profit and verified owner isolation behind a shared proxy peer');
