import assert from 'node:assert/strict';
import { assessCreditJob, type CreditJob } from '../server/creditSpendPolicy.js';
const base: CreditJob = {provider:'vast_ai',customerPaymentVerified:true,customerPaymentUsd:4,estimatedGpuCostUsd:2,availablePrepaidCreditUsd:10,todayCommittedUsd:0,concurrentPaidJobs:0,cardAutoTopupDisabled:true,ownerApproved:true};
assert.equal(assessCreditJob(base).allowed,true);
for(const [field,value,reason] of [
 ['ownerApproved',false,'OWNER_APPROVAL_REQUIRED'],
 ['customerPaymentVerified',false,'CUSTOMER_PAYMENT_UNVERIFIED'],
 ['cardAutoTopupDisabled',false,'AUTO_TOPUP_MUST_BE_DISABLED'],
 ['estimatedGpuCostUsd',3,'PER_JOB_CAP_EXCEEDED'],
 ['todayCommittedUsd',4,'DAILY_CAP_EXCEEDED'],
 ['concurrentPaidJobs',1,'CONCURRENCY_LIMIT'],
 ['availablePrepaidCreditUsd',1,'INSUFFICIENT_PREPAID_CREDIT'],
 ['customerPaymentUsd',2.5,'MARGIN_TOO_LOW'],
 ['estimatedGpuCostUsd',Number.NaN,'INVALID_FINANCIAL_INPUT'],
] as const) {
 const actual=assessCreditJob({...base,[field]:value});
 assert.equal(actual.allowed,false,field);
 assert.equal(actual.reason,reason,field);
}
console.log('PASS: 10 prepaid-credit pilot policy cases');
