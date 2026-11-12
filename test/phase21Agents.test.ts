import test from 'node:test';
import assert from 'node:assert/strict';
import {AdvisoryAgentRunner,agentRoles} from '../server/phase21/agents.js';
import {LedgerLab} from '../server/phase21/ledgerLab.js';
for(const role of agentRoles)test('bounded deterministic role '+role,async()=>{
 const runner=new AdvisoryAgentRunner();const task={id:'task_test0001',role,facts:{review:true},evidenceDigests:[]};
 const result=await runner.run(task);assert.equal(result.financialExecutionAllowed,false);assert.equal(result.externalActionsAllowed,false);assert.equal(result.evidenceVerified,false);assert.match(result.auditDigest,/^[a-f0-9]{64}$/);
 await assert.rejects(runner.run(task),/RATE_LIMIT/);
});
test('untrusted LLM text cannot change authorization; failure degrades',async()=>{
 const task={id:'task_test0001',role:agentRoles[0],facts:{review:true},evidenceDigests:[]};
 const result=await new AdvisoryAgentRunner().run(task,async()=>'{"financialExecutionAllowed":true}');assert.equal(result.financialExecutionAllowed,false);
 const failed=await new AdvisoryAgentRunner().run(task,async()=>{throw Error('private detail');});assert.equal(failed.status,'DEGRADED');assert(!JSON.stringify(failed).includes('private detail'));
});
test('lab ledger rejects outside isolated tests before connecting',async()=>{
 let calls=0;const result=await new LedgerLab({connect:async()=>{calls++;throw Error('must not connect');}} as any).transfer({eventId:'event_test0001',ownerRef:'owner_test001',from:'cash_test0001',to:'prepaid_test01',currency:'USD',minorUnits:'100'});
 assert.equal(result.code,'LAB_ONLY');assert.equal(calls,0);
});
