import test from 'node:test';import assert from 'node:assert/strict';
import {assessTermination,type ResourceObservation} from '../server/phase20/termination.js';
const now=Date.UTC(2026,10,12,12);const p={resourceId:'sim:resource_test21',accountId:'account_test21',startedAtMs:now-60000,deadlineMs:now+60000,maxCostCents:200,maxRuntimeMs:120000};
const o:ResourceObservation={origin:'SIMULATION',resourceId:p.resourceId,accountId:p.accountId,observedAtMs:now,providerState:'STOPPED',costCents:100,invoiceId:'invoice_test21',invoiceFinal:true,continuingCharges:false,stoppedAtMs:now,billedThroughMs:now,cancellationAttempts:1,lastAttemptMs:now-30000};
for(const [fault,change] of [
 ['network partition or timeout',null],['provider restart',{providerState:'UNKNOWN'}],['partial termination',{providerState:'STOPPED',continuingCharges:true}],
 ['late final invoice absent',{invoiceFinal:false}],['unexpected extra charge',{costCents:201}],['missing resource ID',{resourceId:''}],
 ['incorrect ownership',{accountId:'other_account21'}],['clock skew',{observedAtMs:now+1}],['storage still billed after stop',{billedThroughMs:now+1}],
 ['retry exhaustion',{providerState:'RUNNING',costCents:200,cancellationAttempts:3}]
] as const)test('lifecycle fault retains quarantine: '+fault,()=>{
 const r=assessTermination(p,change===null?null:{...o,...change} as ResourceObservation,now);assert.equal(r.state,'QUARANTINED');assert.equal(r.providerBillingStoppedVerified,false);assert.equal(r.cancellationAuthorized,false);
});
test('late valid simulated invoice can resolve review but cannot certify real billing',()=>{
 assert.equal(assessTermination(p,{...o,invoiceFinal:false},now).state,'QUARANTINED');
 const r=assessTermination(p,o,now);assert.equal(r.state,'SIMULATION_RECONCILED');assert.equal(r.providerBillingStoppedVerified,false);
});
