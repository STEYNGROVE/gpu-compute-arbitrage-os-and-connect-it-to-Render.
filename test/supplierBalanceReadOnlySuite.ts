import assert from 'node:assert/strict';
import {probeSupplierBalance} from '../server/supplierBalanceReadOnly.js';
const originalFetch=globalThis.fetch, vast=process.env.VAST_API_KEY,runpod=process.env.RUNPOD_API_KEY;
try{
 delete process.env.VAST_API_KEY;delete process.env.RUNPOD_API_KEY;
 globalThis.fetch=(async()=>{throw Error('unexpected network')}) as typeof fetch;
 assert.equal((await probeSupplierBalance('runpod')).errorCode,'KEY_REQUIRED');
 assert.equal((await probeSupplierBalance('vast_ai')).errorCode,'KEY_REQUIRED');
 process.env.VAST_API_KEY='synthetic-vast-key';process.env.RUNPOD_API_KEY='synthetic-runpod-key';
 const calls:string[]=[];
 globalThis.fetch=(async(input:any,init:any)=>{
  calls.push(String(input));assert.equal(init.redirect,'error');assert.equal(init.method,String(input).includes('runpod')?'POST':'GET');
  return {ok:true,json:async()=>String(input).includes('runpod')?{data:{myself:{id:'test',clientBalance:15,billingMode:'PREPAID',isAutoPayEnabled:false,enableBackupPayments:false,stripeAutoReloadAmount:0}}}:{id:1,credit:10}} as Response;
 }) as typeof fetch;
 const rp=await probeSupplierBalance('runpod'),v=await probeSupplierBalance('vast_ai');
 assert.equal(rp.balanceUsd,15);assert.equal(rp.autoChargeDisabledVerified,true);assert.equal(rp.procurementBlocked,true);
 assert.equal(v.balanceUsd,10);assert.equal(v.autoChargeDisabledVerified,false);assert.equal(v.procurementBlocked,true);
 assert.equal(calls.length,2);
 globalThis.fetch=(async()=>({ok:true,json:async()=>({data:{myself:{id:'test',clientBalance:15,billingMode:'PREPAID',isAutoPayEnabled:true,enableBackupPayments:false,stripeAutoReloadAmount:0}}})} as Response)) as typeof fetch;
 assert.equal((await probeSupplierBalance('runpod')).autoChargeDisabledVerified,false);
 globalThis.fetch=(async()=>({ok:true,json:async()=>({data:{myself:{id:'test',clientBalance:'15',billingMode:'PREPAID',isAutoPayEnabled:false,enableBackupPayments:false,stripeAutoReloadAmount:0}}})} as Response)) as typeof fetch;
 assert.equal((await probeSupplierBalance('runpod')).balanceEvidenceVerified,false);
 console.log('PASS: supplier balance read-only probes, missing credentials, strict billing controls, schema rejection, and procurement block');
}finally{globalThis.fetch=originalFetch;if(vast===undefined)delete process.env.VAST_API_KEY;else process.env.VAST_API_KEY=vast;if(runpod===undefined)delete process.env.RUNPOD_API_KEY;else process.env.RUNPOD_API_KEY=runpod;}
