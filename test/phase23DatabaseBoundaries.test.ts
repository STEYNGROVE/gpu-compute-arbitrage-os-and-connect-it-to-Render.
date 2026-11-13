import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {pgDbService} from '../server/pgDatabase.js';
import {applicationDatabase} from '../server/applicationDatabase.js';
import {secureDatabaseOptions} from '../server/phase21/configuration.js';

// Import legacy adapters with a synthetic configured URL, but never initialize a connection.
const previous=process.env.DATABASE_URL;
const fixture=new URL('postgresql://fixture@database.example/db');fixture.password='synthetic-password';
process.env.DATABASE_URL=fixture.href;
const modules=await Promise.all([
  import('../server/gpuHunterX.js'),import('../server/customerIntelligence.js'),
  import('../server/preapprovedWorkloads.js'),import('../server/commercialIntake.js'),
  import('../server/buyerEvidenceImport.js'),import('../server/commercialEvidence.js'),
  import('../server/ownerOperations.js'),import('../server/usdtInvoiceLedger.js')
]);
const oldQuery=pgDbService.query;
let fail=false;const sqls:string[]=[];
pgDbService.query=(async(sql:string)=>{sqls.push(sql);if(fail)throw Error('PRIVATE_FAILURE');return {rows:[],rowCount:0};}) as typeof oldQuery;
after(async()=>{pgDbService.query=oldQuery;if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pgDbService.close();});

test('legacy adapters share authoritative query and fail closed without schema DDL',async()=>{
  const app=express();const owner:express.RequestHandler=(_q,_r,next)=>next();
  modules[0].registerGpuHunterX(app,owner);modules[1].registerCustomerIntelligence(app,owner);
  modules[2].registerPreapprovedWorkloads(app,owner);modules[3].registerCommercialIntake(app,owner);
  modules[4].registerBuyerEvidenceImport(app,owner);modules[5].registerCommercialEvidence(app,owner);modules[6].registerOwnerOperations(app,owner);
  const server=app.listen(0,'127.0.0.1');
  try {
    await new Promise<void>(r=>server.listening?r():server.once('listening',r));const address=server.address();assert(address&&typeof address!=='string');const base='http://127.0.0.1:'+address.port;
    for(const route of ['/api/owner/gpu-hunter-x/qualified','/api/owner/gpu-hunter-x/unified','/api/owner/customer-intelligence','/api/approvals/workloads']){
      const r=await fetch(base+route);assert.equal(r.status,200,route);
    }
    assert(sqls.length>5);assert(sqls.every(sql=>/^SELECT\b/.test(sql)));
    fail=true;const response=await fetch(base+'/api/owner/gpu-hunter-x/qualified');assert.equal(response.status,503);assert(!(await response.text()).includes('PRIVATE_FAILURE'));fail=false;
  }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
test('invoice mutation entry points cannot run under release lockdown',async()=>{
  sqls.length=0;
  await assert.rejects(modules[7].createUsdtInvoice('customer','1',60),/SIMULATION_LOCKDOWN/);
  await assert.rejects(modules[7].reconcileUsdtInvoice('invalid','invalid'),/SIMULATION_LOCKDOWN/);
  assert.equal(sqls.length,0);
});
test('shared adapter rejects work when authoritative database is unavailable',async()=>{
  pgDbService.query=oldQuery;
  try {await assert.rejects(applicationDatabase.query('SELECT 1'),/DATABASE_UNAVAILABLE/);}finally{pgDbService.query=(async(sql:string)=>{sqls.push(sql);return {rows:[],rowCount:0};}) as typeof oldQuery;}
});
test('runtime source has one pool construction boundary and no runtime DDL',()=>{
  const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):e.name.endsWith('.ts')&&!e.name.endsWith('.test.ts')?[path.join(dir,e.name)]:[]);
  for(const file of walk('server')){
    const source=readFileSync(file,'utf8');
    if(file!=='server/pgDatabase.ts')assert.doesNotMatch(source,/new (?:pg\.)?Pool\s*\(/,file);
    assert.doesNotMatch(source,/(?:CREATE\s+(?:TABLE|(?:UNIQUE\s+)?INDEX)|ALTER\s+TABLE)\s+(?:IF\s+NOT\s+EXISTS\s+)?[a-z_]/i,file);
  }
});
test('internal-looking external DNS and direct fallback parameters cannot bypass TLS',()=>{
  const env={NODE_ENV:'production',RENDER_SERVICE_ID:'srv-fixture',DATABASE_INTERNAL_TRANSPORT:'render-private-network',RENDER_INTERNAL_DB_HOST:'dpg-fixture-a'};
  const url=new URL(fixture);url.hostname='dpg-fixture-a.evil.example';
  assert.deepEqual(secureDatabaseOptions(url.href,env,()=> '').ssl,{rejectUnauthorized:true});
  url.hostname='dpg-fixture-a';
  for(const query of ['host=evil.example','ssl=false','sslmode=disable','sslmode=allow','sslmode=no-verify']){url.search=query;assert.throws(()=>secureDatabaseOptions(url.href,env,()=>''));}
});
