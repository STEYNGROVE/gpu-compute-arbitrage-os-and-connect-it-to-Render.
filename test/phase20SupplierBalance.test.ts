import {test} from 'node:test';
import assert from 'node:assert/strict';
import {probeSupplierBalance} from '../server/supplierBalanceReadOnly.js';
test('read-only balance rejects malformed identities, GraphQL errors and oversized responses',async()=>{
  const fetchOriginal=globalThis.fetch, original=process.env.RUNPOD_API_KEY;
  process.env.RUNPOD_API_KEY='synthetic-phase20-runpod-key';
  try {
    for(const data of [{data:{myself:{id:'   ',clientBalance:100}}},{data:{myself:{id:{fake:true},clientBalance:100}}},{data:{myself:{id:'user',clientBalance:100}},errors:{message:'private-error'}}]) {
      globalThis.fetch=(async()=>new Response(JSON.stringify(data),{status:200})) as typeof fetch;
      const result=await probeSupplierBalance('runpod');assert.equal(result.authenticated,false);assert.equal(result.evidenceStatus,'UNVERIFIED');assert.equal(result.claimsIndependentlyVerified,false);
    }
    globalThis.fetch=(async()=>new Response('x'.repeat(1024*1024+1),{status:200})) as typeof fetch;
    assert.equal((await probeSupplierBalance('runpod')).errorCode,'READ_ONLY_REQUEST_FAILED');
  } finally {globalThis.fetch=fetchOriginal;if(original===undefined)delete process.env.RUNPOD_API_KEY;else process.env.RUNPOD_API_KEY=original;}
});
