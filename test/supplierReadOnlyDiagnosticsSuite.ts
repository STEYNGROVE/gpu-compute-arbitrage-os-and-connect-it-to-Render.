import assert from 'node:assert/strict';
import { probeSupplier } from '../server/supplierReadOnlyDiagnostics.js';
const originalFetch=globalThis.fetch;
const vast=process.env.VAST_API_KEY, runpod=process.env.RUNPOD_API_KEY;
try {
  delete process.env.VAST_API_KEY; delete process.env.RUNPOD_API_KEY;
  globalThis.fetch=(async()=>{throw Error('Missing keys must never call network')}) as typeof fetch;
  const missing=await Promise.all([probeSupplier('vast_ai'),probeSupplier('runpod')]);
  assert(missing.every(x=>x.errorCode==='KEY_REQUIRED' && x.procurementBlocked && !x.authenticated));
  process.env.VAST_API_KEY='synthetic-vast-key';process.env.RUNPOD_API_KEY='synthetic-runpod-key';
  const calls:{url:string;method:string}[]=[];
  globalThis.fetch=(async(input:any,init:any)=>{
    const url=String(input);calls.push({url,method:init.method});
    assert.equal(init.redirect,'error');assert.equal(init.method,url.includes('runpod')?'POST':'GET');
    const data=url.includes('vast.ai') ? (url.includes('users/current')?{id:42}:{offers:[{dph_total:0.9},{dph_total:0}]}) : (String(init.body).includes('myself')?{data:{myself:{id:'user'}}}:{data:{gpuTypes:[{id:'gpu',securePrice:1.5}]}});
    return new Response(JSON.stringify(data), {status:200});
  }) as typeof fetch;
  const results=await Promise.all([probeSupplier('vast_ai'),probeSupplier('runpod')]);
  assert(results.every(x=>x.authenticated && x.inventoryRecords!==null && x.pricedRecords===1 && x.readOnly && x.procurementBlocked));
  assert.equal(calls.length,4);
  assert(calls.every(x=>x.method==='GET'||x.method==='POST'));
  assert(!JSON.stringify(results).includes('synthetic-'));
  globalThis.fetch=(async()=>new Response(JSON.stringify({errors:[{message:'secret'}]}), {status:200})) as typeof fetch;
  const error=await probeSupplier('runpod');assert.equal(error.errorCode,'IDENTITY_GRAPHQL_ERROR');assert(!JSON.stringify(error).includes('secret'));
  for (const data of [{data:{myself:{id:'   '}}}, {data:{myself:{id:{fake:true}}}}, {data:{myself:{id:'valid'}},errors:{message:'malformed'}}]) {
    globalThis.fetch = (async () => new Response(JSON.stringify(data), {status:200})) as typeof fetch;
    const rejected = await probeSupplier('runpod');
    assert.equal(rejected.authenticated, false);
    assert(rejected.errorCode === 'IDENTITY_UNVERIFIED' || rejected.errorCode === 'IDENTITY_GRAPHQL_ERROR');
  }
  globalThis.fetch = (async (input: any) => new Response(JSON.stringify(String(input).includes('users/current') ? {id:42} : {offers:[{dph_base:0.1}]}), {status:200})) as typeof fetch;
  assert.equal((await probeSupplier('vast_ai')).pricedRecords, 0, 'Base-only price cannot establish complete supplier cost');
  globalThis.fetch = (async () => new Response('x'.repeat(1024 * 1024 + 1), {status:200})) as typeof fetch;
  assert.equal((await probeSupplier('vast_ai')).errorCode, 'NETWORK_OR_PARSE_FAILURE');
  console.log('PASS: missing keys, identity, inventory, sanitization, read-only requests, GraphQL errors');
} finally {
  globalThis.fetch=originalFetch;
  if(vast===undefined) delete process.env.VAST_API_KEY; else process.env.VAST_API_KEY=vast;
  if(runpod===undefined) delete process.env.RUNPOD_API_KEY; else process.env.RUNPOD_API_KEY=runpod;
}
