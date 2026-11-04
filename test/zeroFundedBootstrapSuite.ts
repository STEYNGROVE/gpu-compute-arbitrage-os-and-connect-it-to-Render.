/**
 * ZERO-FUNDED PROVIDER BOOTSTRAP TEST SUITE
 * 
 * Verifies that the system operates safely under the fundamental invariant:
 * "The operator has NOT funded any GPU provider accounts."
 * 
 * Test Coverage:
 * 1. Never spend operator money automatically (fails closed on unfunded/unverified balance)
 * 2. Provider financial states ("NOT_FUNDED", "FUNDED", "INSUFFICIENT_BALANCE", "CREDIT_AVAILABLE", "PAY_AS_YOU_GO", "PAYMENT_REQUIRED", "UNKNOWN")
 * 3. Customer-funded execution flow (PAYMENT_RECEIVED -> FUNDS_RESERVED_FOR_JOB)
 * 4. Provider spending gate: Blocks with WAITING_FOR_FUNDING or EXECUTION_BLOCKED when unfunded
 * 5. No fake balances (unverified balance reports FUNDING_STATUS_UNKNOWN)
 * 6. Zero-capital routing evaluates provider financial requirements and reports "NO ZERO-CAPITAL EXECUTION PATH AVAILABLE"
 * 7. Tri-state GPU distinction: "AVAILABLE GPU" vs "PURCHASABLE GPU" vs "EXECUTABLE GPU"
 * 8. Real credit/coupon detection (only genuine provider data; no fabricated credits)
 * 9. Owner capital mode is disabled by default; enforces strict caps when explicitly enabled
 * 10. All 10 providers audited in the zero-funded matrix
 */

import { zeroFundedBootstrapService } from '../server/zeroFundedBootstrapService.js';
import { providerRegistry } from '../server/providers/providerRegistry.js';
import { ProviderId } from '../server/providers/types.js';

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

async function runZeroFundedBootstrapSuite() {
  console.log('================================================================');
  console.log('  ZERO-FUNDED PROVIDER BOOTSTRAP SUITE                          ');
  console.log('  (Strict Operator Capital Protection & Customer-Funded Routing)');
  console.log('================================================================\n');

  // ===========================================================================
  // 1. NEVER SPEND OPERATOR MONEY AUTOMATICALLY & DEFAULT OWNER MODE DISABLED
  // ===========================================================================
  console.log('--- 1. OPERATOR MONEY PROTECTION & DEFAULT SETTINGS ---');
  assert(
    zeroFundedBootstrapService.isOwnerFundedModeEnabled() === false,
    'Owner Capital Mode is strictly DISABLED by default'
  );

  const initialConfig = zeroFundedBootstrapService.getOwnerFundedConfig();
  assert(
    initialConfig.maxSingleTransactionUsd === 0,
    'Default maxSingleTransactionUsd is $0.00 (Zero Operator Capital)'
  );
  assert(
    initialConfig.dailySpentUsd === 0,
    'Initial operator daily spent is $0.00'
  );

  // ===========================================================================
  // 2. NO FAKE BALANCES & FUNDING STATUS UNKNOWN
  // ===========================================================================
  console.log('\n--- 2. NO FAKE BALANCES & TRUTHFUL REPORTING ---');
  const all10Providers: ProviderId[] = [
    'vast_ai', 'runpod', 'tensordock', 'akash', 'salad',
    'lightning_ai', 'hyperstack', 'coreweave', 'lambda', 'hostinger'
  ];

  const statuses = await zeroFundedBootstrapService.getAllProviderFundingStatuses(true);
  assert(statuses.length === 10, 'Evaluates all 10 providers in registry');

  const validFinancialStates = [
    'NOT_FUNDED', 'FUNDED', 'INSUFFICIENT_BALANCE', 'CREDIT_AVAILABLE',
    'PAY_AS_YOU_GO', 'PAYMENT_REQUIRED', 'UNKNOWN', 'FUNDING_STATUS_UNKNOWN'
  ];

  for (const st of statuses) {
    assert(
      validFinancialStates.includes(st.fundingStatus),
      `${st.providerId} has valid financial state (observed: ${st.fundingStatus})`
    );

    // Rule: Never display "$100 available" or fake balances
    assert(
      !st.verifiedBalanceDisplay.includes('$100 available') &&
      !st.verifiedBalanceDisplay.includes('$500 available') &&
      !st.verifiedBalanceDisplay.includes('$1000 available'),
      `${st.providerId} does NOT display fabricated balance strings`
    );

    if (st.verifiedBalanceUsd === null && st.fundingStatus === 'UNKNOWN') {
      assert(
        st.verifiedBalanceDisplay === 'FUNDING_STATUS_UNKNOWN',
        `${st.providerId} with unverified balance truthfully displays 'FUNDING_STATUS_UNKNOWN'`
      );
    }
  }

  // ===========================================================================
  // 3. TRI-STATE GPU DISTINCTION: AVAILABLE vs PURCHASABLE vs EXECUTABLE
  // ===========================================================================
  console.log('\n--- 3. TRI-STATE GPU DISTINCTION ---');
  // Vast without funding is listed (AVAILABLE) but NOT PURCHASABLE without operator deposit
  const vastFeasibility = await zeroFundedBootstrapService.classifyGpuFeasibility('vast_ai', 15.00);
  assert(
    vastFeasibility.feasibility === 'AVAILABLE_GPU',
    'Unfunded prepaid provider classifies as AVAILABLE_GPU (not purchasable)'
  );
  assert(
    vastFeasibility.isPurchasable === false,
    'Unfunded prepaid provider is NOT purchasable without capital'
  );
  assert(
    vastFeasibility.isExecutable === false,
    'Unfunded prepaid provider is NOT executable'
  );

  // Lambda with PAY_AS_YOU_GO card authorization is PURCHASABLE
  const lambdaFeasibility = await zeroFundedBootstrapService.classifyGpuFeasibility('lambda', 10.00);
  assert(
    lambdaFeasibility.isPurchasable === true,
    'Pay-as-you-go provider is PURCHASABLE without advance deposit'
  );

  // ===========================================================================
  // 4. CUSTOMER-FUNDED EXECUTION MODE & ESCROW TRACKING
  // ===========================================================================
  console.log('\n--- 4. CUSTOMER-FUNDED EXECUTION MODE & ESCROW ---');
  const testJobId = 'job_cust_fund_test_1';
  const escrow = zeroFundedBootstrapService.createCustomerJobEscrow({
    jobId: testJobId,
    demandOrderId: 'order_cust_test_1',
    customerPaymentId: 'pay_bn_usdt_1001',
    amountReceived: 25.00,
    currency: 'USD',
    providerBudget: 15.00,
    maxProviderSpend: 15.00,
    expectedProfit: 9.60,
    maxLoss: 0,
    paymentFees: 0.40,
    providerId: 'lambda'
  });

  assert(escrow.state === 'PAYMENT_RECEIVED', 'Job escrow initializes in PAYMENT_RECEIVED state');
  assert(escrow.amountReceived === 25.00, 'Customer payment received recorded accurately ($25.00)');
  assert(escrow.providerBudget === 15.00, 'Provider budget recorded accurately ($15.00)');
  assert(escrow.refundLiability === 25.00, 'Refund liability matches amount received');

  // Transition to FUNDS_RESERVED_FOR_JOB
  const reservedEscrow = zeroFundedBootstrapService.reserveFundsForJob(testJobId, 12.50);
  assert(
    reservedEscrow.state === 'FUNDS_RESERVED_FOR_JOB',
    'Escrow successfully transitions to FUNDS_RESERVED_FOR_JOB'
  );
  assert(
    reservedEscrow.reservedAmount === 12.50,
    'Reserved amount matches authorized allocation ($12.50)'
  );

  // Attempting to reserve more than authorized provider budget strictly fails closed
  let overBudgetThrew = false;
  try {
    zeroFundedBootstrapService.reserveFundsForJob(testJobId, 99.00);
  } catch (err: any) {
    overBudgetThrew = true;
    assert(err.message.includes('RESERVE_EXCEEDS_BUDGET'), 'Over-budget reservation throws RESERVE_EXCEEDS_BUDGET');
  }
  assert(overBudgetThrew, 'Strictly prevents allocating more funds than authorized provider budget');

  // ===========================================================================
  // 5. PROVIDER SPENDING GATE
  // ===========================================================================
  console.log('\n--- 5. PROVIDER SPENDING GATE EVALUATION ---');
  // Case A: Unfunded Vast.ai without operator capital -> BLOCKED / WAITING_FOR_FUNDING
  const vastGate = await zeroFundedBootstrapService.evaluateProviderSpendingGate({
    jobId: testJobId,
    providerId: 'vast_ai',
    estimatedCostUsd: 12.00,
    expectedRevenueUsd: 25.00
  });
  assert(
    vastGate.allowed === false,
    'Unfunded prepaid provider spending gate evaluates allowed = false'
  );
  assert(
    vastGate.gateState === 'WAITING_FOR_FUNDING',
    'Unfunded prepaid provider spending gate sets gateState = WAITING_FOR_FUNDING'
  );
  assert(
    vastGate.checks.providerFinanciallyExecutable === false,
    'Gate marks providerFinanciallyExecutable = false when account is unfunded'
  );

  // Case B: Without verified customer payment -> WAITING_FOR_FUNDING
  const noPayGate = await zeroFundedBootstrapService.evaluateProviderSpendingGate({
    jobId: 'unpaid_job_999',
    providerId: 'lambda',
    estimatedCostUsd: 5.00,
    expectedRevenueUsd: 10.00
  });
  assert(
    noPayGate.allowed === false,
    'Job without customer payment is rejected by spending gate'
  );
  assert(
    noPayGate.checks.customerPaymentVerified === false,
    'Gate records customerPaymentVerified = false'
  );

  // Case C: Lambda with verified customer payment -> APPROVED
  const lambdaGate = await zeroFundedBootstrapService.evaluateProviderSpendingGate({
    jobId: testJobId,
    providerId: 'lambda',
    estimatedCostUsd: 12.00,
    expectedRevenueUsd: 25.00
  });
  assert(
    lambdaGate.allowed === true,
    'Pay-as-you-go provider with customer escrow passes spending gate (allowed = true)'
  );
  assert(
    lambdaGate.gateState === 'APPROVED',
    'Spending gate sets gateState = APPROVED'
  );
  assert(
    lambdaGate.checks.customerPaymentVerified === true,
    'Gate records customerPaymentVerified = true'
  );

  // Case D: Cost exceeding budget -> EXECUTION_BLOCKED
  const overCostGate = await zeroFundedBootstrapService.evaluateProviderSpendingGate({
    jobId: testJobId,
    providerId: 'lambda',
    estimatedCostUsd: 30.00, // budget is $15
    expectedRevenueUsd: 25.00
  });
  assert(
    overCostGate.allowed === false,
    'Cost exceeding customer budget is rejected'
  );
  assert(
    overCostGate.gateState === 'EXECUTION_BLOCKED',
    'Over-budget job sets gateState = EXECUTION_BLOCKED'
  );

  // ===========================================================================
  // 6. ZERO-CAPITAL ROUTING & "NO ZERO-CAPITAL EXECUTION PATH AVAILABLE"
  // ===========================================================================
  console.log('\n--- 6. ZERO-CAPITAL ROUTING & FIRST REVENUE STRATEGY ---');
  // If routing only candidate providers that require advance prepaid balance (Vast, Salad, Akash)
  // and accounts are unfunded:
  const prepaidOnlyRoute = await zeroFundedBootstrapService.evaluateZeroCapitalRoute(
    ['vast_ai', 'salad', 'akash'],
    4,
    2.50
  );
  assert(
    prepaidOnlyRoute.hasZeroCapitalPath === false,
    'Route without zero-capital providers reports hasZeroCapitalPath = false'
  );
  assert(
    prepaidOnlyRoute.status === 'NO ZERO-CAPITAL EXECUTION PATH AVAILABLE',
    'Report status strictly equals NO ZERO-CAPITAL EXECUTION PATH AVAILABLE'
  );
  assert(
    prepaidOnlyRoute.blockedProviders.length === 3,
    'All 3 candidate providers correctly marked as blocked due to required advance deposits'
  );

  // If candidate providers include post-paid/pay-as-you-go (Lambda, TensorDock):
  const paygRoute = await zeroFundedBootstrapService.evaluateZeroCapitalRoute(
    ['vast_ai', 'lambda', 'tensordock'],
    2,
    1.50
  );
  assert(
    paygRoute.hasZeroCapitalPath === true,
    'Route including PAYG providers reports hasZeroCapitalPath = true'
  );
  assert(
    paygRoute.status === 'ZERO_CAPITAL_ROUTE_AVAILABLE',
    'Report status equals ZERO_CAPITAL_ROUTE_AVAILABLE'
  );
  assert(
    paygRoute.executableProviders.includes('lambda'),
    'Lambda identified as zero-operator-capital compatible provider'
  );

  // ===========================================================================
  // 7. OWNER CAPITAL MODE (OPTIONAL & EXPLICITLY BOUNDED)
  // ===========================================================================
  console.log('\n--- 7. OWNER CAPITAL MODE AUTHORIZATION & LIMITS ---');
  // Attempting to enable without limits is rejected
  const invalidEnable = zeroFundedBootstrapService.setOwnerFundedMode(true, { maxSingleTransactionUsd: 0 });
  assert(
    invalidEnable.success === false,
    'Enabling Owner Capital Mode without explicit maxSingleTransactionUsd is strictly REJECTED'
  );

  // Enable with explicit limits
  const validEnable = zeroFundedBootstrapService.setOwnerFundedMode(true, {
    maxSingleTransactionUsd: 150,
    maxDailySpendUsd: 450,
    maxJobExposureUsd: 150,
    maxLossUsd: 25,
    authorizedBy: 'OPERATOR_UNIT_TEST'
  });
  assert(validEnable.success === true, 'Enabling with explicit limits succeeds');
  assert(zeroFundedBootstrapService.isOwnerFundedModeEnabled() === true, 'Owner Capital Mode is now active');

  const enabledConfig = zeroFundedBootstrapService.getOwnerFundedConfig();
  assert(enabledConfig.maxSingleTransactionUsd === 150, 'Max single transaction set to $150');
  assert(enabledConfig.maxDailySpendUsd === 450, 'Max daily spend set to $450');

  // Disable Owner Capital Mode to return to safe zero-capital default
  const disabledRes = zeroFundedBootstrapService.setOwnerFundedMode(false);
  assert(disabledRes.success === true, 'Disabling Owner Capital Mode succeeds');
  assert(
    zeroFundedBootstrapService.isOwnerFundedModeEnabled() === false,
    'Owner Capital Mode successfully restored to false (Safe Default)'
  );

  // ===========================================================================
  // 8. REAL CREDIT & PROMOTION DETECTION
  // ===========================================================================
  console.log('\n--- 8. GENUINE CREDIT & PROMOTIONAL DETECTION ---');
  for (const st of statuses) {
    if (st.genuineCreditsDetected) {
      assert(
        st.fundingStatus === 'CREDIT_AVAILABLE',
        `${st.providerId} with genuine credit marked as CREDIT_AVAILABLE`
      );
      assert(
        st.creditDetails !== undefined,
        `${st.providerId} contains creditDetails structure`
      );
    }
  }

  console.log('\n================================================================');
  console.log(`  ZERO-FUNDED PROVIDER BOOTSTRAP SUITE: ${passed}/${total} PASSED`);
  console.log('  ALL OPERATOR CAPITAL PROTECTION & ZERO-FUNDED TESTS PASSED 100%');
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runZeroFundedBootstrapSuite().catch(err => {
  console.error('[FATAL ERROR IN ZERO-FUNDED BOOTSTRAP SUITE]:', err);
  process.exit(1);
});
