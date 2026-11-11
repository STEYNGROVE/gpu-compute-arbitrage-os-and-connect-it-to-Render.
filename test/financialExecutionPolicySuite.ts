import assert from 'node:assert/strict';
import {assessPurchase,assessPayout} from '../server/financialExecutionPolicy.js';
const now=1700000000000;
const evidence=(id:string)=>({id,verified:true,verifiedAtMs:now-1000,expiresAtMs:now+60000,source:'trusted_adapter' as const});
const purchase={nowMs:now,jobId:'job_12345678',ownerApproved:true,payment:evidence('payment_12345678'),balance:evidence('balance_12345678'),settledCustomerPaymentCents:200,verifiedAvailableCreditCents:1000,estimatedCostCents:100,committedTodayCents:0,activePaidJobs:0,autoTopupDisabled:true,killSwitchVerified:true,reservationCommitted:true};
assert.equal(assessPurchase(purchase).allowed,true);
for (const [key,value] of [['ownerApproved',false],['estimatedCostCents',201],['committedTodayCents',450],['activePaidJobs',1],['verifiedAvailableCreditCents',0],['autoTopupDisabled',false],['killSwitchVerified',false],['reservationCommitted',false]] as const) {
  assert.equal(assessPurchase({...purchase,[key]:value}).allowed,false,String(key));
}
assert.equal(assessPurchase({...purchase,payment:{...purchase.payment,verified:false}}).allowed,false);
assert.equal(assessPurchase({...purchase,balance:{...purchase.balance,expiresAtMs:now}}).allowed,false);
const payout={nowMs:now,payoutId:'payout_12345678',ownerApproved:true,settlement:evidence('settled_12345678'),destination:evidence('destination_12345678'),settledProfitCents:5000,previouslyPaidCents:1000,requestedCents:1000,duplicatePayoutId:false,destinationAllowlisted:true};
assert.equal(assessPayout(payout).allowed,true);
assert.equal(assessPayout({...payout,duplicatePayoutId:true}).allowed,false);
assert.equal(assessPayout({...payout,requestedCents:5000}).allowed,false);
assert.equal(assessPayout({...payout,destinationAllowlisted:false}).allowed,false);
assert.equal(assessPayout({...payout,settlement:{...payout.settlement,verified:false}}).allowed,false);
assert.equal(assessPayout({...payout,ownerApproved:false}).allowed,false);
console.log('PASS: financial policy positive and negative cases; no financial actions executed');
