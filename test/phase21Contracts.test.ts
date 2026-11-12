import test from 'node:test';import assert from 'node:assert/strict';
import {reviewProviderContract,type ProviderContract} from '../server/phase21/providerContract.js';
import {modelScenario} from '../server/phase21/financialModel.js';
import {reviewPaymentEvent} from '../server/phase21/paymentBoundary.js';
import {EvidenceAuthority} from '../server/phase20/evidence.js';
import {receipt,now} from './phase20Fixtures.js';
for(const provider of ['vast_ai','runpod'] as const)test(provider+' full recorded contract fails closed on missing cost/binding',()=>{
 const r:ProviderContract={provider,accountId:'account_test01',offerId:'offer_test0001',gpuModel:'A100',vramGb:80,quantity:1,region:'ZA',resourceType:'ON_DEMAND',hourlyMinorUnits:100,currency:'USD',minimumBillingSeconds:60,storageHourlyMinorUnits:1,networkPerGbMinorUnits:1,termsReference:'terms_test0001',resourceId:'sim:resource001',cancellationSemantics:'DESTROY_REQUIRES_FINAL_INVOICE',observedAtMs:now,expiresAtMs:now+60000};
 const policy={provider,accountId:r.accountId,regions:['ZA']};assert.equal(reviewProviderContract(r,policy,now).executionAuthorized,false);
 for(const change of [{storageHourlyMinorUnits:undefined},{region:'unknown'},{accountId:'wrong_account01'},{expiresAtMs:now},{minimumBillingSeconds:0}])assert.throws(()=>reviewProviderContract({...r,...change} as ProviderContract,policy,now));
});
test('financial model scenarios conserve cents and never report realized revenue',()=>{
 const low=modelScenario(2500),base=modelScenario(6000),high=modelScenario(9000);assert(BigInt(low.usd.netCents)<0n);assert(BigInt(base.usd.netCents)<BigInt(high.usd.netCents));assert.equal(high.realizedRevenueCents,'0');assert.equal(BigInt(high.zar.netCents),BigInt(high.usd.netCents)*18n);assert.throws(()=>modelScenario(10001));
});
test('payment fixture cannot authorize collection, posting or recognition',()=>{
 const r=reviewPaymentEvent(receipt,{customerId:receipt.payload.subjectId,accountId:receipt.payload.accountId,contractId:'contract_test01',orderId:'order_test0001',currency:'USD',amountMinorUnits:100},new EvidenceAuthority(),now);
 assert.equal(r.status,'REJECTED');assert.equal(r.collectionAllowed,false);assert.equal(r.postingAllowed,false);assert.equal(r.recognitionAllowed,false);
});

test('runtime port is explicit and bounded',async()=>{
 const {runtimePort}=await import('../server/phase21/httpSecurity.js');assert.equal(runtimePort(undefined),3000);assert.equal(runtimePort('10000'),10000);for(const s of ['0','65536','-1','NaN','3000;'])assert.throws(()=>runtimePort(s));
});

test('collector circuit bounds concurrent requests, backoff, failures and half-open recovery',async()=>{
 const {CollectorCircuit}=await import('../server/phase21/circuitBreaker.js');const circuit=new CollectorCircuit(['ACCOUNT']);
 let finish=circuit.enter('ACCOUNT',0);assert.throws(()=>circuit.enter('ACCOUNT',1),/RATE_LIMIT/);finish(false,0);finish(true,0);
 finish=circuit.enter('ACCOUNT',30000);finish(false,30000);finish=circuit.enter('ACCOUNT',60000);finish(false,60000);
 assert.throws(()=>circuit.enter('ACCOUNT',90000),/CIRCUIT_OPEN/);finish=circuit.enter('ACCOUNT',120000);finish(true,120000);
 assert.throws(()=>circuit.enter('UNKNOWN',150000),/INVALID/);assert.doesNotThrow(()=>circuit.enter('ACCOUNT',150000));
});

test('production HTTP headers apply to actual responses without permitting cross-origin credentials',async()=>{
 const {default:express}=await import('express');const {productionHeaders}=await import('../server/phase21/httpSecurity.js');
 const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';const app=express();app.use(productionHeaders);app.get('/api/probe',(_req,res)=>res.json({ok:true}));
 const server=app.listen(0,'127.0.0.1');try {
  await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address() as {port:number};const r=await fetch('http://127.0.0.1:'+address.port+'/api/probe',{headers:{Origin:'https://attacker.example'}});
  assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-frame-options'),'DENY');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.match(r.headers.get('strict-transport-security')!,/31536000/);assert.match(r.headers.get('content-security-policy')!,/frame-ancestors 'none'/);assert.equal(r.headers.get('access-control-allow-credentials'),null);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});
