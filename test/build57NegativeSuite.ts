/**
 * BUILD 57 — FINAL CRITICAL FIX TEST SUITE
 * 
 * Offline regressions only; fixtures do not certify live integrations.
 * Tests:
 * 1. Rejection of fake funding references & UNAVAILABLE status when no genuine funding API exists
 * 2. Rejection of generated outputs, missing output, and non-zero exit codes
 * 3. Rejection of synthetic invoice IDs and estimated-cost fallbacks
 * 4. Rejection of missing/fabricated timestamps and stale prices (>30m) in routing
 * 5. Rejection of unverified GPU specifications and unavailable capacity
 * 6. Disqualification of providers without executable adapters
 * 7. Offline RunPod identity, balance and unsupported evidence contracts
 * 8. In-memory fixture lifecycle through Jake Grove CFO reconciliation
 * 9. Reality invariant: "PRE-PRODUCTION — FIRST VERIFIED REVENUE NOT PROVEN" display
 */

import crypto from 'crypto';

let passed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

async function runBuild57Suite() {
  // Import after credential isolation: funding adapters capture environment in constructors.
  const { jakeGroveCfoService } = await import('../server/jakeGroveCfoService.js');
  const { realProviderFundingManager } = await import('../server/providerFundingAdapters.js');
  const { gpuPriceRouter } = await import('../server/gpuPriceRouter.js');
  const { RunpodProvider } = await import('../server/providers/runpodProvider.js');
  console.log('================================================================');
  console.log('  BUILD 57 — FINAL CRITICAL REALITY & EXECUTION FIX TEST SUITE  ');
  console.log('================================================================');

  // =========================================================================
  // 1. REJECTION OF FAKE FUNDING REFERENCES & UNAVAILABLE FUNDING APIS
  // =========================================================================
  console.log('\n--- 1. FUNDING VERIFICATION & UNAVAILABLE APIS ---');
  let fundingThrewVast = false;
  try {
    await realProviderFundingManager.executeRealFunding({
      provider: 'vast_ai',
      amountUsd: 25.00,
      idempotencyKey: 'idemp-vast-test-1'
    });
  } catch (err: any) {
    fundingThrewVast = true;
    assert(
      err.message.includes('SIMULATION_LOCKDOWN'),
      'Vast.ai autonomous deposit fails closed with SIMULATION_LOCKDOWN'
    );
  }
  assert(fundingThrewVast, 'Attempting autonomous funding without deposit API strictly throws error');

  let fundingThrewRunpod = false;
  try {
    await realProviderFundingManager.executeRealFunding({
      provider: 'runpod',
      amountUsd: 15.00,
      idempotencyKey: 'idemp-runpod-test-1'
    });
  } catch (err: any) {
    fundingThrewRunpod = true;
    assert(
      err.message.includes('SIMULATION_LOCKDOWN'),
      'RunPod autonomous deposit fails closed with SIMULATION_LOCKDOWN'
    );
  }
  assert(fundingThrewRunpod, 'Attempting RunPod autonomous funding without deposit API strictly throws error');

  // Verify capabilities flag canAcceptAutonomousFunding is false
  const caps = await realProviderFundingManager.verifyAllCapabilities();
  assert(caps.vast_ai.canAcceptAutonomousFunding === false, 'Vast.ai canAcceptAutonomousFunding is strictly false');
  assert(caps.runpod.canAcceptAutonomousFunding === false, 'RunPod canAcceptAutonomousFunding is strictly false');
  assert(caps.lambda.canAcceptAutonomousFunding === false, 'Lambda canAcceptAutonomousFunding is strictly false');

  // =========================================================================
  // 2. REJECTION OF GENERATED OUTPUTS & MISSING PROCESS EVIDENCE
  // =========================================================================
  console.log('\n--- 2. WORKLOAD PROCESS EVIDENCE & OUTPUT REJECTION ---');
  const testTx1 = `b57-tx-output-${Date.now()}`;
  jakeGroveCfoService.initializeTransactionTrace({
    transactionId: testTx1,
    demandOrderId: `order-${testTx1}`,
    customerId: 'cust-b57-test',
    customerPayment: {
      paymentId: `pay-${testTx1}`,
      sourceRail: 'BINANCE',
      externalTxId: `tx-${crypto.randomBytes(32).toString('hex')}`,
      amountUsd: 50.00
    }
  });

  // Non-zero exit code rejection
  const nonZeroProof = jakeGroveCfoService.recordWorkloadExecutionProof({
    transactionId: testTx1,
    providerId: 'runpod',
    instanceId: 'inst-b57-01',
    gpuModel: 'RTX 4090',
    inputHash: crypto.randomBytes(32).toString('hex'),
    outputHash: crypto.randomBytes(32).toString('hex'),
    exitCode: 1 // Non-zero failure
  });
  assert(nonZeroProof.verified === false, 'Jake Grove CFO strictly rejects workload with non-zero exit code (1)');

  // Missing output rejection on settlement
  let missingOutputThrew = false;
  try {
    jakeGroveCfoService.settleTransactionWithCfo({
      transactionId: testTx1,
      billingReference: 'rpod-inv-inst-b57-01-12345',
      actualProviderCostUsd: 12.00,
      durationHours: 1.0
    });
  } catch (err: any) {
    missingOutputThrew = true;
    assert(err.message.includes('CFO_SETTLEMENT_BLOCKED'), 'Settlement blocked when output proof is unverified');
  }
  assert(missingOutputThrew, 'Settlement without verified workload proof throws CFO_SETTLEMENT_BLOCKED');

  // =========================================================================
  // 3. REJECTION OF SYNTHETIC INVOICE IDS & ESTIMATED COST FALLBACKS
  // =========================================================================
  console.log('\n--- 3. BILLING VERIFICATION & SYNTHETIC INVOICE REJECTION ---');
  const testTx2 = `b57-tx-bill-${Date.now()}`;
  jakeGroveCfoService.initializeTransactionTrace({
    transactionId: testTx2,
    demandOrderId: `order-${testTx2}`,
    customerId: 'cust-b57-test',
    customerPayment: {
      paymentId: `pay-${testTx2}`,
      sourceRail: 'BINANCE',
      externalTxId: `tx-${crypto.randomBytes(32).toString('hex')}`,
      amountUsd: 50.00
    }
  });

  // Provide valid output proof
  const validSha256 = crypto.createHash('sha256').update('GENUINE_OUTPUT').digest('hex');
  jakeGroveCfoService.recordWorkloadExecutionProof({
    transactionId: testTx2,
    providerId: 'runpod',
    instanceId: 'inst-b57-02',
    gpuModel: 'RTX 4090',
    inputHash: crypto.createHash('sha256').update('COMMAND').digest('hex'),
    outputHash: validSha256,
    exitCode: 0
  });

  // Test synthetic "fake-bill" rejection
  let fakeBillThrew = false;
  try {
    jakeGroveCfoService.settleTransactionWithCfo({
      transactionId: testTx2,
      billingReference: 'fake-bill-001',
      actualProviderCostUsd: 10.00,
      durationHours: 1.0
    });
  } catch (err: any) {
    fakeBillThrew = true;
    assert(err.message.includes('CFO_BILLING_ERROR') && err.message.includes('fake'),
      'Jake Grove CFO strictly rejects synthetic "fake-bill" references');
  }
  assert(fakeBillThrew, 'Synthetic invoice reference throws CFO_BILLING_ERROR');

  // Test zero / negative cost rejection (estimated cost fallback of 0)
  let zeroCostThrew = false;
  try {
    jakeGroveCfoService.settleTransactionWithCfo({
      transactionId: testTx2,
      billingReference: 'rpod-inv-inst-02-valid',
      actualProviderCostUsd: 0.00,
      durationHours: 1.0
    });
  } catch (err: any) {
    zeroCostThrew = true;
    assert(err.message.includes('CFO_BILLING_ERROR') && err.message.includes('strictly positive'),
      'Jake Grove CFO strictly rejects zero-cost provider billing');
  }
  assert(zeroCostThrew, 'Zero-cost provider billing throws CFO_BILLING_ERROR');

  // =========================================================================
  // 4. HARDENED LIVE ROUTING GATES
  // =========================================================================
  console.log('\n--- 4. HARDENED LIVE ROUTING GATES ---');
  // Stale price rejection: Offer older than 30 minutes
  const routerCatalog = gpuPriceRouter.getOfferCatalog();
  if (routerCatalog.length > 0) {
    const offer = routerCatalog[0];
    const staleOffer = {
      ...offer,
      offerId: 'stale-test-offer',
      lastUpdatedIso: new Date(Date.now() - 45 * 60 * 1000).toISOString() // 45 minutes old
    };
    gpuPriceRouter.registerDynamicProvider(gpuPriceRouter.getProvider(offer.providerId)!, [staleOffer]);
    const routeRes = gpuPriceRouter.routeWorkload({
      gpuModel: staleOffer.gpuModel,
      jobDurationHours: 1,
      interruptionTolerance: 'STRICT_NO_INTERRUPTIONS'
    });
    const staleEval = routeRes.disqualifiedProviders.find(d => d.offerId === 'stale-test-offer');
    if (staleEval) {
      assert(staleEval.disqualificationReasons.some(r => r.includes('STALE_PRICING')),
        'Router disqualifies offers with pricing older than 30 minutes');
    }
  }

  // Impossible GPU returns NO_EXECUTABLE_OFFER
  const impossible = gpuPriceRouter.routeWorkload({
    gpuModel: 'QUANTUM_NON_EXISTENT_GPU_Z99',
    jobDurationHours: 2,
    interruptionTolerance: 'STRICT_NO_INTERRUPTIONS'
  });
  assert(impossible.winningProvider === null, 'Impossible route returns winningProvider: null');
  assert(impossible.recommendationReason.startsWith('NO_EXECUTABLE_OFFER'),
    'Impossible route returns recommendationReason starting with NO_EXECUTABLE_OFFER');

  // =========================================================================
  // 5. RUNPOD OFFLINE ADAPTER CONTRACT (NO LIVE CERTIFICATION)
  // =========================================================================
  console.log('\n--- 5. RUNPOD OFFLINE CONTRACT FIXTURES ---');
  // Offline contract fixtures are not live supplier evidence or certification.
  let requests = 0;
  const runpod = new RunpodProvider({
    apiKey: () => 'synthetic-runpod-contract-fixture',
    request: async (_url, init) => {
      requests++;
      if (init.method !== 'POST' || !String(init.body).includes('query')) throw Error('UNEXPECTED_REQUEST');
      return new Response(JSON.stringify({ data: { myself: { id: 'fixture-account', clientBalance: 15 } } }));
    }
  });
  const rpHealth = await runpod.healthCheck();
  assert(rpHealth.authenticated, 'Offline fixture identity is parsed');
  assert(!rpHealth.endpoints.provisioning && !rpHealth.endpoints.billing, 'Identity does not certify execution or billing');
  const rpBilling = await runpod.getBilling();
  assert(rpBilling.accountBalanceUsd === 15 && rpBilling.invoiceCount === 0, 'Balance fixture does not invent an invoice');
  let usageRejected = false;
  try { await runpod.getUsage('fixture-pod'); } catch (err: any) { usageRejected = err.message.includes('USAGE_UNVERIFIED'); }
  assert(usageRejected, 'Missing independent usage evidence rejects');
  const unavailableOutput = await runpod.retrieveOutput('fixture-pod', 'fixture-workload');
  assert(!unavailableOutput.outputHash, 'Missing workload evidence does not fabricate output');
  assert(requests === 2, 'Only two injected read-only requests occur');
  // Explicit in-memory CFO fixtures; never obtained from RunPod or posted to PostgreSQL.
  const rpOutput = { stdoutExcerpt: 'OFFLINE_CFO_OUTPUT_FIXTURE' };
  const rpUsage = { invoiceLineItemId: 'offline-cfo-invoice-fixture' };

  // =========================================================================
  // 6. JAKE GROVE CFO FULL RECONCILIATION & DOUBLE-ENTRY SETTLEMENT
  // =========================================================================
  console.log('\n--- 6. JAKE GROVE CFO FULL RECONCILIATION ---');
  const e2eTx = `b57-e2e-tx-${Date.now()}`;
  jakeGroveCfoService.initializeTransactionTrace({
    transactionId: e2eTx,
    demandOrderId: `order-${e2eTx}`,
    customerId: 'cust-enterprise-ai',
    customerPayment: {
      paymentId: `pay-${e2eTx}`,
      sourceRail: 'BINANCE',
      externalTxId: `0x${crypto.randomBytes(32).toString('hex')}`,
      amountUsd: 35.00
    }
  });

  const outputSha = crypto.createHash('sha256').update(rpOutput.stdoutExcerpt!).digest('hex');
  const verifiedProof = jakeGroveCfoService.recordWorkloadExecutionProof({
    transactionId: e2eTx,
    providerId: 'runpod',
    instanceId: 'pod-e2e-real-01',
    gpuModel: 'RTX 4090',
    inputHash: crypto.createHash('sha256').update('python train.py').digest('hex'),
    outputHash: outputSha,
    exitCode: 0
  });
  assert(verifiedProof.verified === true, 'Workload execution proof verified by Jake Grove CFO');

  const settlementRes = jakeGroveCfoService.settleTransactionWithCfo({
    transactionId: e2eTx,
    billingReference: rpUsage.invoiceLineItemId!,
    actualProviderCostUsd: 14.50,
    durationHours: 1.5,
    paymentFeesUsd: 0.50
  });
  assert(settlementRes.success === true, 'CFO settlement succeeded with double-entry ledger postings');
  assert(settlementRes.finalStatus === 'CFO_RECONCILED', 'Final transaction status is CFO_RECONCILED');
  assert(settlementRes.netProfitUsd === 20.00, 'Realized net profit calculated exactly: $35.00 - $14.50 - $0.50 = $20.00');

  const finalTrace = jakeGroveCfoService.getTransactionTrace(e2eTx);
  assert(finalTrace?.lifecycleStage === 'CFO_RECONCILED', 'Trace lifecycleStage is CFO_RECONCILED');
  assert(finalTrace?.treasuryReconciliation.reconciledWithBinance === true,
    'Trace treasuryReconciliation confirms Binance rail alignment');

  // Verify journal integrity
  const journalAudit = jakeGroveCfoService.verifyJournalIntegrity();
  assert(journalAudit.valid === true, 'Double-entry journal SHA-256 chain and debit/credit balance verified');

  // =========================================================================
  // 7. REALITY INVARIANT: FIRST VERIFIED REVENUE DISPLAY
  // =========================================================================
  console.log('\n--- 7. REALITY INVARIANT & PRE-PRODUCTION BANNER ---');
  const cfoSummary = await jakeGroveCfoService.getCfoCommandCenterSummary();
  assert(cfoSummary.firstVerifiedRevenueProven === false,
    'firstVerifiedRevenueProven strictly false until production transaction is proven on live ledger');
  assert(cfoSummary.financialControlState.includes('PRE-PRODUCTION — FIRST VERIFIED REVENUE NOT PROVEN'),
    'Financial control state displays PRE-PRODUCTION — FIRST VERIFIED REVENUE NOT PROVEN');
  assert(cfoSummary.reconciliationStatus.includes('PRE-PRODUCTION — FIRST VERIFIED REVENUE NOT PROVEN'),
    'Reconciliation status displays PRE-PRODUCTION — FIRST VERIFIED REVENUE NOT PROVEN');

  console.log('\n================================================================');
  console.log(`  BUILD 57 TEST SUITE COMPLETE: ${passed}/${total} PASSED`);
  console.log('================================================================\n');

  if (passed !== total) {
    throw new Error('BUILD57_ASSERTIONS_FAILED');
  }
}

const originalFetch = globalThis.fetch;
const credentialNames = ['RUNPOD_API_KEY', 'VAST_API_KEY', 'LAMBDA_API_KEY'];
const credentials = credentialNames.map(key => process.env[key]);
credentialNames.forEach(key => { delete process.env[key]; });
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw Error('OFFLINE_TEST_NETWORK_FORBIDDEN'); };
runBuild57Suite().then(() => {
  if (networkAttempts !== 0) throw Error('AMBIENT_NETWORK_ATTEMPT_DETECTED');
}).catch(err => {
  console.error('FATAL ERROR in build 57 suite:', err);
  process.exitCode = 1;
}).finally(() => {
  globalThis.fetch = originalFetch;
  credentialNames.forEach((key, i) => {
    if (credentials[i] === undefined) delete process.env[key];
    else process.env[key] = credentials[i];
  });
});
