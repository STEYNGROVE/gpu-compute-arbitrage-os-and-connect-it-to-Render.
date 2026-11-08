import assert from 'node:assert/strict';
import {reservePrepaidCredit,reserveVerifiedCredit} from '../server/prepaidReservationGate.js';
const prev=process.env.GPU_PURCHASING_ENABLED;
const prevEvidence=process.env.GPU_EVIDENCE_VERIFIER_READY;
const mockPool:any={connect:async()=>{throw new Error('DATABASE_SHOULD_NOT_BE_TOUCHED')}};
const job:any={jobId:'job_12345678',customerPaymentEvidenceId:'payment_12345678',providerBalanceEvidenceId:'balance_12345678',ownerApprovalEvidenceId:'approval_12345678',job:{provider:'vast_ai',customerPaymentVerified:true,customerPaymentUsd:4,estimatedGpuCostUsd:2,availablePrepaidCreditUsd:10,todayCommittedUsd:0,concurrentPaidJobs:0,cardAutoTopupDisabled:true,ownerApproved:true}};
async function main(){
try {
 delete process.env.GPU_PURCHASING_ENABLED;
 assert.equal((await reservePrepaidCredit(mockPool,job)).reason,'PURCHASING_DISABLED');
 assert.equal((await reserveVerifiedCredit(mockPool,job,1000,400)).reason,'PURCHASING_DISABLED');
 process.env.GPU_PURCHASING_ENABLED='true';
 delete process.env.GPU_EVIDENCE_VERIFIER_READY;
 assert.equal((await reservePrepaidCredit(mockPool,job)).reason,'EVIDENCE_VERIFIER_NOT_READY');
 assert.equal((await reserveVerifiedCredit(mockPool,job,1000,400)).reason,'EVIDENCE_VERIFIER_NOT_READY');
 process.env.GPU_EVIDENCE_VERIFIER_READY='true';
 assert.equal((await reservePrepaidCredit(mockPool,job)).reason,'EXTERNAL_EVIDENCE_VERIFICATION_NOT_IMPLEMENTED');
 assert.equal((await reserveVerifiedCredit(mockPool,{...job,jobId:'bad'},1000,400)).reason,'INVALID_JOB_ID');
 assert.equal((await reserveVerifiedCredit(mockPool,job,-1,400)).reason,'INVALID_VERIFIED_EVIDENCE');
 assert.equal((await reserveVerifiedCredit(mockPool,{...job,job:{...job.job,estimatedGpuCostUsd:3}},1000,400)).reason,'PER_JOB_CAP_EXCEEDED');
 console.log('PASS: 8 fail-closed prepaid reservation checks');
} finally {
 if(prev===undefined) delete process.env.GPU_PURCHASING_ENABLED; else process.env.GPU_PURCHASING_ENABLED=prev;
 if(prevEvidence===undefined) delete process.env.GPU_EVIDENCE_VERIFIER_READY; else process.env.GPU_EVIDENCE_VERIFIER_READY=prevEvidence;
}}
main().catch(e=>{console.error(e);process.exitCode=1});
