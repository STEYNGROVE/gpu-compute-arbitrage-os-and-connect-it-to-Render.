import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { EvidenceAuthority, canonicalFacts, receiptBytes, sha256, type EvidenceReceipt } from '../server/phase20/evidence.js';
import { qualifySupplier, SupplierCollectionLimiter } from '../server/phase20/supplierEvidence.js';
import { previewGateway, PostgresSimulationGateway, SimulationProvisioningAdapter, gatewayDigest, denyRealExecution, parseGatewayRequest } from '../server/phase20/gateway.js';
import { planEvidenceQuote } from '../server/phase20/quotation.js';
import { evaluateRevenueTransition, revenueStages } from '../server/phase20/commercialEvidence.js';
import { assessTermination, SimulationCancellationAdapter, cancelRealResource, type ResourceObservation } from '../server/phase20/termination.js';
import { now, quote, receipt, request } from './phase20Fixtures.js';
import { requestPurchase } from '../server/launchReadiness/boundaries.js';

for (const field of ['maxCostCents','maxRuntimeMs','gpuCount','minVramGb'] as const) {
  test(`gateway rejects invalid ${field}`,()=>{
    for (const value of [NaN,Infinity,-1,0,Number.MAX_SAFE_INTEGER+1]) assert.throws(()=>parseGatewayRequest({...request,[field]:value}));
  });
}
test('gateway validates exact schema and retains simulation-only review',()=>{
  assert.equal(previewGateway(request).executionAuthorized,false);
  assert.throws(()=>parseGatewayRequest({...request,approved:true}));
  assert.throws(()=>parseGatewayRequest({...request,maxCostCents:201}));
  assert.throws(()=>parseGatewayRequest({...request,provider:'unconfigured'}));
});
test('real requests denied before database or transport regardless of LIVE settings',async()=>{
  const saved={...process.env};
  try {
    process.env.EXECUTION_MODE='LIVE';process.env.GPU_PURCHASING_ENABLED='true';process.env.GPU_EVIDENCE_VERIFIER_READY='true';
    const gateway=new PostgresSimulationGateway({connect:()=>{throw Error('FORBIDDEN_DB');},query:()=>{throw Error('FORBIDDEN_DB');}} as any);
    assert.equal((await gateway.reserve({...request,mode:'REAL'})).code,denyRealExecution().reason);
    assert.equal((await requestPurchase({...request,mode:'REAL'})).executionAuthorized,false);
    assert.equal((await cancelRealResource('real-resource')).allowed,false);
  } finally {for(const key of Object.keys(process.env)) if(!(key in saved)) delete process.env[key];Object.assign(process.env,saved);}
});
test('simulated and manual supplier receipts can never be VERIFIED',()=>{
  const authority=new EvidenceAuthority(new Map(),'INDEPENDENT');
  for(const origin of ['SIMULATION','MANUAL'] as const) assert.equal(authority.assess({...receipt,payload:{...receipt.payload,origin}},'SUPPLIER','supplier:vast_ai','account_test01',now).status,'UNVERIFIED');
});
test('cryptographic collector binding remains partial in offline verification',()=>{
  const pair=generateKeyPairSync('ed25519');
  const candidate:EvidenceReceipt=structuredClone(receipt);candidate.payload.origin='INDEPENDENT_READ_ONLY';
  const authority=new EvidenceAuthority(new Map([[candidate.issuer,{publicKeyPem:pair.publicKey.export({type:'spki',format:'pem'}).toString(),kinds:['SUPPLIER']}]]),'OFFLINE_TEST');
  candidate.signature=sign(null,Buffer.from(receiptBytes(candidate)),pair.privateKey).toString('base64');
  const result=authority.assess(candidate,'SUPPLIER','supplier:vast_ai','account_test01',now);
  assert.equal(result.status,'PARTIALLY_VERIFIED');assert.equal(result.signatureVerified,true);
  candidate.payload.facts.balanceCents=100000;
  assert.equal(authority.assess(candidate,'SUPPLIER','supplier:vast_ai','account_test01',now).status,'REJECTED');
});
test('receipt rejects wrong account, expiry, future/invalid dates, unknown issuer and oversized facts',()=>{
  const authority=new EvidenceAuthority();
  assert.equal(authority.assess(receipt,'SUPPLIER','supplier:vast_ai','different_account',now).status,'REJECTED');
  assert.equal(authority.assess(receipt,'SUPPLIER','supplier:vast_ai','account_test01',now+61000).status,'EXPIRED');
  for(const observedAt of ['2026-02-30T00:00:00Z','2026-11-12T12:00:00','2026-11-13T12:00:00Z']) assert.equal(authority.assess({...receipt,payload:{...receipt.payload,observedAt}},'SUPPLIER','supplier:vast_ai','account_test01',now).status,'REJECTED');
  assert.throws(()=>canonicalFacts({nested:{value:true}}));assert.throws(()=>canonicalFacts({field:'x'.repeat(1001)}));
});
test('supplier hardware, pricing and billing requirements fail closed',()=>{
  const req={provider:'vast_ai' as const,accountId:'account_test01',offerId:'offer_test0001',gpuModel:'H100',gpuCount:1,minVramGb:80,maxExposureCents:150};
  assert.equal(qualifySupplier(receipt,req,new EvidenceAuthority(),now).status,'UNVERIFIED');
  for(const facts of [{autoChargeDisabled:false},{vramGb:40},{balanceCents:1},{totalHourlyCents:NaN},{available:false},{currency:'ZAR'}]) assert.equal(qualifySupplier({...receipt,payload:{...receipt.payload,facts:{...receipt.payload.facts,...facts}}},req,new EvidenceAuthority(),now).status,'REJECTED');
});
test('collector enforces per-provider concurrency and cooldown with copied data',async()=>{
  const limiter=new SupplierCollectionLimiter();let resolve!:(r:EvidenceReceipt)=>void;
  const collector={provider:'vast_ai' as const,collect:async()=>await new Promise<EvidenceReceipt>(r=>{resolve=r;})};
  const first=limiter.collect(collector,now);
  await assert.rejects(limiter.collect(collector,now),/RATE_LIMIT/);resolve(receipt);
  const data=await first;assert.notEqual(data,receipt);
  await assert.rejects(limiter.collect(collector,now+1000),/RATE_LIMIT/);
});
for(const current of revenueStages.slice(0,-1)) test(`commercial ${current} cannot advance using manual or simulated evidence`,()=>{
  const next=revenueStages[revenueStages.indexOf(current)+1];
  const chain={customerId:'customer_test01',accountId:'account_test01',orderId:'order_test001',workloadId:'workload_test01',contractId:'contract_test01',amountCents:100,receipts:{}};
  const result=evaluateRevenueTransition(current,next,chain,new EvidenceAuthority(),now);
  assert.equal(result.allowedForEvidenceRecording,false);assert.equal(result.realizedRevenuePostedCents,0);assert.equal(result.financialPostingPerformed,false);
});
test('commercial evidence never skips categories',()=>{
  const result=evaluateRevenueTransition('PROJECTED_REVENUE','REALIZED_REVENUE',{customerId:'customer_test01',accountId:'account_test01',orderId:'order_test001',workloadId:'workload_test01',contractId:'contract_test01',amountCents:100,receipts:{}},new EvidenceAuthority(),now);
  assert(result.reasons.includes('INVALID_REVENUE_TRANSITION'));
});
test('draft quotation counts full bundle and explicitly priced overhead, tax, utilization and contingency',()=>{
  const result=planEvidenceQuote(quote,now)!;
  assert.equal(result.supplierCostCents,200);assert.equal(result.estimatedRevenueCents,800);assert.equal(result.platformFeeCents,40);
  assert.equal(result.taxCents,30);assert.equal(result.contingencyCents,30);assert.equal(result.totalEstimatedCostCents,360);assert.equal(result.estimatedProfitCents,440);
  assert.equal(result.purchasingAllowed,false);assert.equal(result.realizedRevenueCents,0);assert.equal(result.origin,'SIMULATION');
});
test('quotation rejects missing costs, incompatible VRAM and stale evidence',()=>{
  for(const value of [NaN,Infinity,-1,undefined,Number.MAX_SAFE_INTEGER]) assert.throws(()=>planEvidenceQuote({...quote,networkCents:value} as any,now));
  assert.throws(()=>planEvidenceQuote({...quote,requirement:{...quote.requirement,minVramGb:100}},now));
  assert.throws(()=>planEvidenceQuote(quote,now+61000));
  assert.equal(planEvidenceQuote({...quote,minimumMarginBps:9000},now),null);
});
test('FX evidence requires matching currencies, source and freshness, with conservative rounding',()=>{
  const foreign={...quote,supplier:{...quote.supplier,currency:'EUR'}};
  assert.throws(()=>planEvidenceQuote(foreign,now),/FX/);
  const fx={basis:'MINOR_TO_USD_CENTS' as const,fromCurrency:'EUR',toCurrency:'USD' as const,numerator:11,denominator:10,sourceUrl:'https://example.org/fx',observedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+10000).toISOString(),evidenceId:'fx_test000001'};
  assert.equal(planEvidenceQuote({...foreign,fx},now)!.supplierCostCents,220);
  assert.throws(()=>planEvidenceQuote({...foreign,fx:{...fx,denominator:0}},now));
});
const policy={resourceId:'sim:resource_test01',accountId:'account_test01',startedAtMs:now-60000,deadlineMs:now+60000,maxCostCents:150,maxRuntimeMs:120000};
const observation:ResourceObservation={origin:'SIMULATION',resourceId:policy.resourceId,accountId:policy.accountId,observedAtMs:now,providerState:'RUNNING',costCents:10,invoiceId:'invoice_test001',invoiceFinal:false,continuingCharges:false,stoppedAtMs:null,billedThroughMs:now,cancellationAttempts:0,lastAttemptMs:null};
for(const [name,change,state] of [
  ['within runtime',{},'MONITOR'],['cost cutoff',{costCents:150},'STOP_REQUIRED'],['overspend',{costCents:151},'QUARANTINED'],
  ['unknown state',{providerState:'UNKNOWN'},'QUARANTINED'],['orphan absent',{providerState:'ABSENT'},'QUARANTINED'],
  ['continuing charges',{continuingCharges:true},'QUARANTINED'],['wrong account',{accountId:'other_account'},'QUARANTINED'],
  ['stale observation',{observedAtMs:now-300001},'QUARANTINED'],['retry exhausted',{costCents:150,cancellationAttempts:3},'QUARANTINED'],
  ['retry backoff',{costCents:150,cancellationAttempts:1,lastAttemptMs:now-1000},'STOP_REQUIRED'],
  ['retry due',{costCents:150,cancellationAttempts:1,lastAttemptMs:now-30001},'RETRY_STOP'],
  ['missing final invoice',{providerState:'STOPPED',stoppedAtMs:now},'QUARANTINED'],
  ['simulated final invoice',{providerState:'STOPPED',stoppedAtMs:now,invoiceFinal:true},'SIMULATION_RECONCILED'],
  ['independent claim needs verifier',{origin:'INDEPENDENT_READ_ONLY',providerState:'STOPPED',stoppedAtMs:now,invoiceFinal:true},'QUARANTINED']
] as const) test(`termination: ${name}`,()=>{
  const result=assessTermination(policy,{...observation,...change} as ResourceObservation,now);
  assert.equal(result.state,state);assert.equal(result.providerBillingStoppedVerified,false);assert.equal(result.cancellationAuthorized,false);assert.equal(result.settlementAuthorized,false);
});
test('termination deadline and orphan recovery are fail closed',()=>{
  assert.equal(assessTermination({...policy,deadlineMs:now},observation,now).state,'STOP_REQUIRED');
  assert.equal(assessTermination(policy,null,now).state,'QUARANTINED');
});
test('simulated cancellation is idempotent and rejects real resources',()=>{
  const adapter=new SimulationCancellationAdapter();
  assert.deepEqual(adapter.cancel('sim:resource_test01','cancel_test0001'),adapter.cancel('sim:resource_test01','cancel_test0001'));
  assert.throws(()=>adapter.cancel('real_resource01','cancel_test0001'));
});

test('simulation provisioning is bound, deterministic and never claims paid capacity',()=>{
  const adapter=new SimulationProvisioningAdapter();
  const record={id:sha256(request.idempotencyKey),idempotency_key:request.idempotencyKey,request_digest:gatewayDigest(request),state:'SIMULATION_RESERVED' as const,version:1,max_cost_cents:150,deadline_ms:String(Date.now()+60000),created_at:new Date(),cancellation_attempts:0,last_attempt_ms:null};
  const simulated=adapter.simulate(request,record);
  assert.deepEqual(simulated,adapter.simulate(request,record));assert.equal(simulated.capacityVerified,false);assert.equal(simulated.realMoneySpentCents,0);
  assert.throws(()=>adapter.simulate({...request,maxCostCents:100},record));assert.equal(adapter.executeReal().allowed,false);
});
