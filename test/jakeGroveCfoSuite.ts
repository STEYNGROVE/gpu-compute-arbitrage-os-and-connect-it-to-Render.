/**
 * JAKE GROVE — AUTONOMOUS CFO TEST SUITE (BUILD 53)
 * 
 * Verifies the authoritative financial control plane:
 * 1. Immutable double-entry ledger with zero float drift and SHA-256 hash chaining
 * 2. CFO Approval Gates (zero-funded enforcement, verified customer payment, positive margin)
 * 3. 10-Stage Transaction lifecycle from demand to "CFO_RECONCILED"
 * 4. Workload proof verification (exit code 0, SHA-256 artifact hash)
 * 5. Actual cost settlement and true profit calculation (no estimates in realized profit)
 * 6. Reconciliation exception handling (freeze spending, preserve evidence, alert)
 * 7. End-to-end First Verified Revenue Acid Test execution
 */

import { jakeGroveCfoService } from '../server/jakeGroveCfoService.js';
import { zeroFundedBootstrapService } from '../server/zeroFundedBootstrapService.js';
import crypto from 'crypto';

let passed = 0;
let total = 0;

function assert(condition: boolean, name: string, detail?: string) {
  total++;
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}${detail ? ` (${detail})` : ''}`);
    process.exitCode = 1;
  }
}

async function runJakeGroveCfoSuite() {
  console.log('================================================================');
  console.log('  JAKE GROVE — AUTONOMOUS CFO VERIFICATION SUITE (BUILD 53)     ');
  console.log('  (Immutable Ledger, Financial Control Plane & Zero Drift)     ');
  console.log('================================================================\n');

  // ===========================================================================
  // 1. IMMUTABLE DOUBLE-ENTRY LEDGER & CRYPTOGRAPHIC HASH CHAINING
  // ===========================================================================
  console.log('--- 1. IMMUTABLE DOUBLE-ENTRY LEDGER ---');
  const initialAudit = jakeGroveCfoService.verifyJournalIntegrity();
  assert(initialAudit.isBalanced, 'Ledger debits strictly match credits');
  assert(initialAudit.hashChainValid, 'Journal SHA-256 hash chain is cryptographically valid');

  const testRef = `test-tx-${Date.now()}`;
  const posting = jakeGroveCfoService.recordDoubleEntryPosting({
    transactionRef: testRef,
    debitAccount: 'ASSETS:1010_BINANCE_SPOT_USDT',
    creditAccount: 'LIABILITIES:2010_CUSTOMER_ESCROW_OBLIGATION',
    amountUsd: 15.50,
    description: 'Test escrow deposit',
    evidenceRef: 'binance-tx-hash-0x123'
  });

  assert(posting.amountFormatted === 15.50, 'Posting records correct formatted USD amount ($15.50)');
  assert(posting.auditHash.length === 64, 'Posting generates authentic 64-character SHA-256 audit hash');

  const afterAudit = jakeGroveCfoService.verifyJournalIntegrity();
  assert(afterAudit.isBalanced, 'Ledger remains balanced after new posting');
  assert(afterAudit.hashChainValid, 'Hash chain maintains unbroken link after posting');

  // Rejection of negative / zero amounts
  let threwZero = false;
  try {
    jakeGroveCfoService.recordDoubleEntryPosting({
      transactionRef: testRef,
      debitAccount: 'ASSETS:CASH',
      creditAccount: 'REVENUE:SALES',
      amountUsd: 0.00,
      description: 'Zero test',
      evidenceRef: 'none'
    });
  } catch {
    threwZero = true;
  }
  assert(threwZero, 'Ledger strictly rejects $0.00 zero-value postings');

  // ===========================================================================
  // 2. JAKE GROVE CFO APPROVAL GATE
  // ===========================================================================
  console.log('\n--- 2. JAKE GROVE CFO APPROVAL GATES ---');
  const unverifiedTxId = `unverified-${Date.now()}`;

  // Attempt approval without verified customer payment in escrow -> Must FAIL CLOSED
  const rejectedDecision = await jakeGroveCfoService.evaluateCfoApprovalGate({
    transactionId: unverifiedTxId,
    demandOrderId: 'ord-unverified',
    quoteId: 'quo-unverified',
    customerId: 'cust-unverified',
    customerPaymentId: 'pay-unverified',
    providerId: 'runpod',
    gpuModel: 'NVIDIA RTX 4090',
    customerRevenueUsd: 20.00,
    expectedProviderCostUsd: 12.00
  });

  assert(rejectedDecision.approved === false, 'Rejects transactions without verified customer payment');
  assert(rejectedDecision.gateStatus === 'WAITING_FOR_FUNDING', 'Decision status is WAITING_FOR_FUNDING');
  assert(rejectedDecision.approvalToken === null, 'No approval token issued for unverified customer');

  // Setup valid escrow reservation
  const validTxId = `valid-tx-${Date.now()}`;
  const validOrderId = `ord-${validTxId}`;
  const validPayId = `pay-${validTxId}`;

  zeroFundedBootstrapService.createCustomerJobEscrow({
    jobId: validTxId,
    demandOrderId: validOrderId,
    customerPaymentId: validPayId,
    amountReceived: 25.00,
    currency: 'USD',
    providerBudget: 15.00,
    maxProviderSpend: 15.00,
    expectedProfit: 9.65,
    maxLoss: 0,
    paymentFees: 0.35,
    providerId: 'lambda'
  });
  zeroFundedBootstrapService.reserveFundsForJob(validTxId, 15.00);

  // Unprofitable deal check: Provider cost > customer revenue
  const unprofitableDecision = await jakeGroveCfoService.evaluateCfoApprovalGate({
    transactionId: validTxId,
    demandOrderId: validOrderId,
    quoteId: `quo-${validTxId}`,
    customerId: 'cust-valid',
    customerPaymentId: validPayId,
    providerId: 'lambda',
    gpuModel: 'NVIDIA RTX A6000',
    customerRevenueUsd: 10.00,
    expectedProviderCostUsd: 12.00
  });

  assert(unprofitableDecision.approved === false, 'Strictly rejects negative net margin transaction');
  assert(unprofitableDecision.gateStatus === 'REJECTED', 'Status is REJECTED for unprofitable transaction');

  // Profitable deal with customer funds reserved
  const approvedDecision = await jakeGroveCfoService.evaluateCfoApprovalGate({
    transactionId: validTxId,
    demandOrderId: validOrderId,
    quoteId: `quo-${validTxId}`,
    customerId: 'cust-valid',
    customerPaymentId: validPayId,
    providerId: 'lambda',
    gpuModel: 'NVIDIA RTX A6000',
    customerRevenueUsd: 25.00,
    expectedProviderCostUsd: 14.50,
    paymentFeesUsd: 0.35
  });

  assert(approvedDecision.approved === true, 'Approves profitable transaction with verified customer escrow');
  assert(approvedDecision.gateStatus === 'APPROVED', 'Gate status is APPROVED');
  assert(Boolean(approvedDecision.approvalToken?.startsWith('cfo-appr-')), 'Issues cryptographic approval token');
  assert(approvedDecision.checks.customerPaymentConfirmed, 'Customer payment confirmed flag is true');
  assert(approvedDecision.checks.zeroOperatorCapitalSatisfied, 'Zero operator capital satisfied flag is true');

  // ===========================================================================
  // 3. WORKLOAD EXECUTION PROOF & HASH VERIFICATION
  // ===========================================================================
  console.log('\n--- 3. WORKLOAD EXECUTION PROOF & VERIFICATION ---');
  jakeGroveCfoService.initializeTransactionTrace({
    transactionId: validTxId,
    demandOrderId: validOrderId,
    customerId: 'cust-valid',
    customerPayment: {
      paymentId: validPayId,
      sourceRail: 'BINANCE',
      externalTxId: '0x123456789abcdef',
      amountUsd: 25.00
    }
  });

  // Test failed workload (non-zero exit code)
  const failedWorkload = jakeGroveCfoService.recordWorkloadExecutionProof({
    transactionId: validTxId,
    providerId: 'lambda',
    instanceId: 'inst-1',
    gpuModel: 'NVIDIA RTX A6000',
    inputHash: crypto.randomBytes(32).toString('hex'),
    outputHash: crypto.randomBytes(32).toString('hex'),
    exitCode: 1 // Exit code failure!
  });
  assert(failedWorkload.verified === false, 'Fails closed on non-zero workload exit code');

  // Test successful workload
  const validOutputHash = crypto.randomBytes(32).toString('hex');
  const successfulWorkload = jakeGroveCfoService.recordWorkloadExecutionProof({
    transactionId: validTxId,
    providerId: 'lambda',
    instanceId: 'inst-1',
    gpuModel: 'NVIDIA RTX A6000',
    inputHash: crypto.randomBytes(32).toString('hex'),
    outputHash: validOutputHash,
    exitCode: 0,
    stdoutExcerpt: 'LLM completion generated successfully.'
  });
  assert(successfulWorkload.verified === true, 'Verifies workload with exit code 0 and valid SHA-256 output hash');

  // ===========================================================================
  // 4. SETTLEMENT & "CFO_RECONCILED" FINAL STATE
  // ===========================================================================
  console.log('\n--- 4. SETTLEMENT, ACTUAL COST & CFO_RECONCILED ---');
  const settlementResult = jakeGroveCfoService.settleTransactionWithCfo({
    transactionId: validTxId,
    billingReference: 'inv-lambda-real-998',
    actualProviderCostUsd: 14.50,
    durationHours: 2.0,
    paymentFeesUsd: 0.35
  });

  assert(settlementResult.success === true, 'Settlement executes successfully');
  assert(settlementResult.finalStatus === 'CFO_RECONCILED', 'Transaction reaches final state "CFO_RECONCILED"');
  // 25.00 - 14.50 - 0.35 = 10.15
  assert(settlementResult.netProfitUsd === 10.15, 'Calculates true realized profit: $25.00 - $14.50 - $0.35 = $10.15');

  const trace = jakeGroveCfoService.getTransactionTrace(validTxId);
  assert(trace?.lifecycleStage === 'CFO_RECONCILED', 'Trace record lifecycle stage is "CFO_RECONCILED"');
  assert(trace?.treasuryReconciliation.reconciledWithBinance === true, 'Reconciled with Binance treasury rail');

  // ===========================================================================
  // 5. RECONCILIATION EXCEPTION FREEZE
  // ===========================================================================
  console.log('\n--- 5. RECONCILIATION EXCEPTION & AUTOMATIC FREEZE ---');
  const exceptionTxId = `tx-exc-${Date.now()}`;
  jakeGroveCfoService.initializeTransactionTrace({
    transactionId: exceptionTxId,
    demandOrderId: 'ord-exc',
    customerId: 'cust-exc',
    customerPayment: {
      paymentId: 'pay-exc',
      sourceRail: 'BINANCE',
      externalTxId: '0xabc',
      amountUsd: 10.00
    }
  });

  jakeGroveCfoService.handleReconciliationException({
    transactionId: exceptionTxId,
    component: 'TREASURY_SETTLEMENT',
    expected: 'Spot balance matches ledger exactly',
    observed: 'Discrepancy of $1.50 detected on external rail'
  });

  const excTrace = jakeGroveCfoService.getTransactionTrace(exceptionTxId);
  assert(excTrace?.lifecycleStage === 'RECONCILIATION_EXCEPTION', 'Exception moves lifecycle to RECONCILIATION_EXCEPTION');
  assert(excTrace?.treasuryReconciliation.finalStatus === 'RECONCILIATION_EXCEPTION', 'Final status flags exception');

  const activeExceptions = jakeGroveCfoService.getExceptions();
  assert(activeExceptions.some(e => e.transactionId === exceptionTxId && e.frozen === true), 'Freezes related spending on exception');

  // ===========================================================================
  // 6. FIRST VERIFIED REVENUE ACID TEST (SECTION 13)
  // ===========================================================================
  console.log('\n--- 6. FIRST VERIFIED REVENUE ACID TEST (SECTION 13) ---');
  const acidResult = await jakeGroveCfoService.executeFirstVerifiedRevenueAcidTest();
  assert(acidResult.passed === false && acidResult.isSimulation === false, 'Unfunded real-evidence audit correctly reports incomplete verification');
  assert(acidResult.finalStatus === 'UNVERIFIED_EXTERNAL_EVIDENCE', 'Unfunded audit does not claim successful reconciliation');
  assert(acidResult.realizedProfitUsd === 0, `No unverified realized profit ($${acidResult.realizedProfitUsd.toFixed(2)})`);
  assert(acidResult.stages.length === 10, 'All 10 external-evidence stages evaluated');

  // ===========================================================================
  // 7. CFO COMMAND CENTER SUMMARY PROVENANCE
  // ===========================================================================
  console.log('\n--- 7. CFO COMMAND CENTER PROVENANCE ---');
  const summary = await jakeGroveCfoService.getCfoCommandCenterSummary();
  assert(summary.cfoName === 'Jake Grove', 'Authoritative CFO name is Jake Grove');
  assert(Boolean(summary.cash.source), 'Cash metric includes verified source provenance');
  assert(Boolean(summary.revenue.source), 'Revenue metric includes verified source provenance');
  assert(summary.spending24hOperatorUsd === 0.00, '24h Operator spend is strictly $0.00');

  console.log('\n================================================================');
  console.log(`  JAKE GROVE CFO TEST SUITE COMPLETE: ${passed}/${total} PASSED`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runJakeGroveCfoSuite().catch(err => {
  console.error('Fatal error in Jake Grove CFO suite:', err);
  process.exit(1);
});
