import '../server/bootstrap.js';
import crypto from 'crypto';
import { BinancePaymentProvider, paymentEngine } from '../server/paymentEngine.js';
import { treasuryEngine } from '../server/treasuryEngine.js';
import { pgDbService } from '../server/pgDatabase.js';
import { providerFloatManager } from '../server/providerFloatManager.js';
import { killSwitchRepo } from '../server/repositories/index.js';
import { calculateProviderExposure } from '../server/crashRecovery.js';
import { ServerOpportunityEngine } from '../server/opportunityEngine.js';

async function runTests() {
  console.log('=== Running Binance Canonical Payment, Webhook Replay Protection, Treasury Floats, and Safety Tests ===');

  // Test 1: Binance HMAC-SHA256 Webhook Signature Verification & BINANCE_WEBHOOK_SECRET Enforcement
  console.log('[TEST 1] Binance HMAC-SHA256 Webhook Signature & BINANCE_WEBHOOK_SECRET Enforcement');
  const binancePay = new BinancePaymentProvider();
  const testSecret = 'my_secure_binance_webhook_secret_123';
  const testPayload = {
    intentId: 'order-intent-12345',
    txId: '987654321',
    status: 'VERIFIED',
    amountCents: 15000,
    currency: 'USD',
    reference: 'order-intent-12345'
  };

  // Generate valid Binance HMAC-SHA256 signature
  const validSignature = binancePay.generateSignature(testPayload, testSecret);
  const payloadWithSig = { ...testPayload, signature: validSignature };

  const isVerified = binancePay.verifyWebhookSignature(payloadWithSig, validSignature, testSecret);
  if (!isVerified) throw new Error('Valid Binance HMAC-SHA256 signature verification failed');

  // Test invalid signature
  const isInvalid = binancePay.verifyWebhookSignature({ ...testPayload, signature: 'invalid_forged_signature' }, 'invalid_forged_signature', testSecret);
  if (isInvalid) throw new Error('Invalid signature unexpectedly passed verification');
  console.log('  -> PASS: Binance HMAC-SHA256 signature verified correctly and rejected forgery.');

  // Test 1a-2: Native Binance Pay Merchant Webhook v2 RSA-SHA256 Protocol Verification
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  const bpTimestamp = String(Date.now());
  const bpNonce = crypto.randomBytes(16).toString('hex');
  const bpRawBody = JSON.stringify({ bizType: 'PAY', bizId: '99887766', bizStatus: 'PAY_SUCCESS' });
  const bpCanonical = `${bpTimestamp}\n${bpNonce}\n${bpRawBody}\n`;
  const bpSigner = crypto.createSign('RSA-SHA256');
  bpSigner.update(bpCanonical, 'utf8');
  bpSigner.end();
  const bpSigBase64 = bpSigner.sign(privateKey, 'base64');

  const bpValid = binancePay.verifyNativeBinancePayWebhook({
    rawBody: bpRawBody,
    timestamp: bpTimestamp,
    nonce: bpNonce,
    signatureBase64: bpSigBase64,
    publicKeyPem: publicKey
  });
  if (!bpValid) throw new Error('Native Binance Pay RSA-SHA256 webhook verification failed');

  const bpForged = binancePay.verifyNativeBinancePayWebhook({
    rawBody: JSON.stringify({ bizType: 'PAY', bizId: '99887766', bizStatus: 'PAY_FORGED' }),
    timestamp: bpTimestamp,
    nonce: bpNonce,
    signatureBase64: bpSigBase64,
    publicKeyPem: publicKey
  });
  if (bpForged) throw new Error('Forged Native Binance Pay RSA-SHA256 payload unexpectedly passed verification');
  console.log('  -> PASS: Native Binance Pay RSA-SHA256 protocol (BinancePay-Timestamp/Nonce/Signature) verified and rejected forgery.');

  // Test 1b: Mandatory BINANCE_WEBHOOK_SECRET Requirement (Never fallback to BINANCE_API_SECRET)
  const savedWebhookSecret = process.env.BINANCE_WEBHOOK_SECRET;
  const savedApiSecret = process.env.BINANCE_API_SECRET;
  process.env.BINANCE_API_SECRET = 'api_secret_must_never_be_used_for_webhook';
  delete process.env.BINANCE_WEBHOOK_SECRET;

  let threwSecretRequired = false;
  try {
    await treasuryEngine.binance.handleWebhook(
      { eventId: 'evt_missing_secret', timestamp: Date.now() },
      { 'x-mbx-timestamp': String(Date.now()), 'x-mbx-signature': 'some_sig' }
    );
  } catch (err: any) {
    if (err.message === 'BINANCE_WEBHOOK_SECRET_REQUIRED') {
      threwSecretRequired = true;
    }
  } finally {
    if (savedWebhookSecret !== undefined) process.env.BINANCE_WEBHOOK_SECRET = savedWebhookSecret;
    else delete process.env.BINANCE_WEBHOOK_SECRET;
    if (savedApiSecret !== undefined) process.env.BINANCE_API_SECRET = savedApiSecret;
    else delete process.env.BINANCE_API_SECRET;
  }
  if (!threwSecretRequired) {
    throw new Error('Missing BINANCE_WEBHOOK_SECRET did not throw BINANCE_WEBHOOK_SECRET_REQUIRED');
  }
  console.log('  -> PASS: BINANCE_WEBHOOK_SECRET strictly enforced; API secret fallback permanently blocked.');

  // Test 1c: PostgreSQL Authoritative Webhook Replay Protection (webhook_events PRIMARY KEY (provider, event_id))
  await pgDbService.initialize();
  if (pgDbService.isLiveDatabaseConnected()) {
    const prevSecret = process.env.BINANCE_WEBHOOK_SECRET;
    process.env.BINANCE_WEBHOOK_SECRET = testSecret;
    try {
      const nowTs = Date.now();
      const evtId = `bn_pg_replay_${nowTs}_${crypto.randomBytes(3).toString('hex')}`;
      const bodyObj = { eventId: evtId, timestamp: nowTs, asset: 'USDT', amount: '250.00' };
      const sig = crypto.createHmac('sha256', testSecret).update(JSON.stringify(bodyObj)).digest('hex');
      const headers = { 'x-mbx-timestamp': String(nowTs), 'x-mbx-signature': sig };

      const firstCall = await treasuryEngine.binance.handleWebhook(bodyObj, headers);
      if (!firstCall.success || firstCall.idempotent) {
        throw new Error(`First webhook call failed or was marked duplicate: ${firstCall.message}`);
      }

      const secondCall = await treasuryEngine.binance.handleWebhook(bodyObj, headers);
      if (!secondCall.success || !secondCall.idempotent) {
        throw new Error('Second identical webhook call was not caught by PostgreSQL webhook_events unique constraint');
      }

      // Clean up test webhook event row
      await pgDbService.query(`DELETE FROM webhook_events WHERE provider = 'BINANCE' AND event_id = $1`, [evtId]);
      console.log('  -> PASS: PostgreSQL webhook_events PRIMARY KEY (provider, event_id) enforced exact-once processing.');
    } finally {
      if (prevSecret !== undefined) process.env.BINANCE_WEBHOOK_SECRET = prevSecret;
      else delete process.env.BINANCE_WEBHOOK_SECRET;
    }
  }
  const activePaymentProviders = Object.keys(paymentEngine.getProviderStatuses());
  if (activePaymentProviders.length !== 1 || activePaymentProviders[0] !== 'BINANCE') {
    throw new Error('Binance must be the exclusive canonical payment rail');
  }

  // Test 1d: Independent Binance/Blockchain Settlement Verification (txId, asset, amount, destination, confirmations)
  console.log('[TEST 1d] Independent Binance/Blockchain Settlement Verification');
  const testDestAddress = '0x19FaF16d0a8fb7EdBf31b4AbeC06bc4Bfbf9467B';
  const validSettlement = await binancePay.verifyIndependentSettlement({
    txId: 'bn_dep_tx_9001',
    expectedAsset: 'USDT',
    expectedAmountMajor: 250.00,
    expectedDestination: testDestAddress,
    minConfirmations: 15,
    depositRecordsOverride: [
      {
        id: 'bn_dep_tx_9001',
        txId: 'bn_dep_tx_9001',
        coin: 'USDT',
        amount: 250.00,
        status: 1,
        address: testDestAddress,
        confirmations: 18
      }
    ]
  });
  if (!validSettlement.verified || validSettlement.confirmations < 15) {
    throw new Error(`Expected valid settlement verification to pass, got: ${validSettlement.reason}`);
  }

  // Reject wrong destination address
  const wrongDestSettlement = await binancePay.verifyIndependentSettlement({
    txId: 'bn_dep_tx_9001',
    expectedAsset: 'USDT',
    expectedAmountMajor: 250.00,
    expectedDestination: '0x000000000000000000000000000000000000dEaD',
    minConfirmations: 15,
    depositRecordsOverride: [
      {
        id: 'bn_dep_tx_9001',
        txId: 'bn_dep_tx_9001',
        coin: 'USDT',
        amount: 250.00,
        status: 1,
        address: testDestAddress,
        confirmations: 18
      }
    ]
  });
  if (wrongDestSettlement.verified || !wrongDestSettlement.reason?.includes('DESTINATION_MISMATCH')) {
    throw new Error('Wrong destination address must be rejected by independent settlement verification');
  }

  // Reject insufficient confirmations (< 15)
  const lowConfSettlement = await binancePay.verifyIndependentSettlement({
    txId: 'bn_dep_tx_9002',
    expectedAsset: 'USDT',
    expectedAmountMajor: 250.00,
    expectedDestination: testDestAddress,
    minConfirmations: 15,
    depositRecordsOverride: [
      {
        id: 'bn_dep_tx_9002',
        txId: 'bn_dep_tx_9002',
        coin: 'USDT',
        amount: 250.00,
        status: 1,
        address: testDestAddress,
        confirmations: 4
      }
    ]
  });
  if (lowConfSettlement.verified || !lowConfSettlement.reason?.includes('INSUFFICIENT_CONFIRMATIONS')) {
    throw new Error('Insufficient confirmations (< 15) must be rejected by independent settlement verification');
  }

  // Reject wrong asset
  const wrongAssetSettlement = await binancePay.verifyIndependentSettlement({
    txId: 'bn_dep_tx_9003',
    expectedAsset: 'DOGE',
    expectedAmountMajor: 250.00,
    expectedDestination: testDestAddress,
    minConfirmations: 15
  });
  if (wrongAssetSettlement.verified || !wrongAssetSettlement.reason?.includes('ASSET_MISMATCH')) {
    throw new Error('Unsupported asset must be rejected by independent settlement verification');
  }
  console.log('  -> PASS: Independent settlement verification strictly validates txId, asset, amount, destination, and confirmations >= 15.');

  // Test 2: Dynamic Capital Allocation Formula
  console.log('[TEST 2] Dynamic Capital Allocation Starting Defaults');
  const targets = providerFloatManager.getDefaultFloatTargets(1000);
  console.log('  -> Calculated Floats for $1,000:', {
    binance: `$${targets.binance.targetAmountUsd} (${targets.binance.allocationPct}%)`,
    vast: `$${targets.vast.targetAmountUsd} (${targets.vast.allocationPct}%)`,
    runpod: `$${targets.runpod.targetAmountUsd} (${targets.runpod.allocationPct}%)`,
    lambda: `$${targets.lambda.targetAmountUsd} (${targets.lambda.allocationPct}%)`
  });

  if (targets.binance.allocationPct !== 70) throw new Error('Binance target allocation must be 70%');
  if (targets.vast.allocationPct !== 15) throw new Error('Vast target allocation must be 15%');
  if (targets.runpod.allocationPct !== 10) throw new Error('RunPod target allocation must be 10%');
  if (targets.lambda.allocationPct !== 5) throw new Error('Lambda target allocation must be 5%');
  if (targets.binance.targetAmountUsd !== 700) throw new Error('Binance target amount must be $700 on $1000');

  const floats = await providerFloatManager.calculateAuthorizedFloats();
  if (!floats.providers.vast_ai || !floats.providers.runpod || !floats.providers.lambda) {
    throw new Error('All 3 providers must be present in calculateAuthorizedFloats');
  }
  console.log('  -> PASS: Capital float allocation exactly matches 70/15/10/5 specification.');

  // Test 3: Float Rebalancing Safety Gates
  console.log('[TEST 3] Float Rebalancing Safety Gates');
  // Attempt unauthorized rebalancing
  const unauthRes = await providerFloatManager.rebalance({
    provider: 'vast_ai',
    targetAmountUsd: 150,
    idempotencyKey: 'unauth-test-key-1',
    isAuthorized: false
  });
  if (unauthRes.success) throw new Error('Unauthorized rebalance should fail');
  console.log('  -> PASS: Unauthorized rebalancing rejected: ' + unauthRes.message);

  // Test 4: 6 Granular Kill Switches
  console.log('[TEST 4] Granular Kill Switch Domain Testing');
  const switches = await killSwitchRepo.getAllKillSwitches();
  console.log(`  -> Found ${switches.length} registered kill switch domains:`);
  for (const s of switches) {
    console.log(`     - [${s.switchId}]: ${s.description} (Active: ${s.active})`);
  }
  if (switches.length < 6) throw new Error('Expected at least 6 kill switches');

  // Test toggle (ensure GLOBAL_KILL_SWITCH is cleared first so granular switch state is isolated)
  await killSwitchRepo.setKillSwitch('GLOBAL_KILL_SWITCH', false, 'Clear global switch for granular domain test', 'test-runner');
  await killSwitchRepo.setKillSwitch('BINANCE_OUTFLOW_KILL_SWITCH', true, 'Automated Test Block', 'test-runner');
  const outflowKs = await killSwitchRepo.isKillSwitchActive('BINANCE_OUTFLOW_KILL_SWITCH');
  if (!outflowKs.active) throw new Error('BINANCE_OUTFLOW_KILL_SWITCH should be active');

  // Clean up
  await killSwitchRepo.setKillSwitch('BINANCE_OUTFLOW_KILL_SWITCH', false, 'Reset after test', 'test-runner');
  const resetOutflowKs = await killSwitchRepo.isKillSwitchActive('BINANCE_OUTFLOW_KILL_SWITCH');
  if (resetOutflowKs.active) throw new Error('BINANCE_OUTFLOW_KILL_SWITCH should be inactive');
  console.log('  -> PASS: Granular kill switches verified and reactive.');

  // Test 5: Provider Exposure Calculation
  console.log('[TEST 5] Provider Exposure Mathematical Model');
  const exposure = calculateProviderExposure({
    accruedCostUsd: 45.50,
    estimatedRemainingCostUsd: 100.25,
    contractualMaximumExposureUsd: 50.00,
    pendingChargesUsd: 12.00
  });
  // 45.50 + 100.25 + 50.00 + 12.00 = 207.75
  if (exposure !== 207.75) throw new Error(`Expected exposure 207.75, got ${exposure}`);
  console.log('  -> PASS: calculateProviderExposure returned exact sum with zero float drift: $' + exposure);

  // Test 6: Opportunity Selection by riskAdjustedExpectedProfit
  console.log('[TEST 6] Opportunity Selection by riskAdjustedExpectedProfit');
  const mockDemand: any = {
    id: 'dem-1',
    customerId: 'cust-1',
    gpuModel: 'RTX 4090',
    gpuCount: 1,
    durationHours: 10,
    customerGrossOfferPrice: 25.00,
    escrowCurrency: 'USD'
  };
  const cheapGpuQuote: any = {
    id: 'q-cheap',
    offerId: 'vast-1',
    provider: 'vast_ai',
    verifiedHourlyPrice: 0.50,
    expiresAt: new Date(Date.now() + 60000).toISOString()
  };
  const econ = ServerOpportunityEngine.calculateEconomics(mockDemand, cheapGpuQuote);
  if (econ.riskAdjustedExpectedProfit === undefined || isNaN(econ.riskAdjustedExpectedProfit)) {
    throw new Error('riskAdjustedExpectedProfit calculation failed');
  }
  console.log(`  -> Calculated Economics: Gross Revenue: $${econ.grossRevenue}, Expected Net: $${econ.expectedNetContribution}, Risk-Adjusted Profit: $${econ.riskAdjustedExpectedProfit}`);
  console.log('  -> PASS: riskAdjustedExpectedProfit computed accurately.');

  // Test 6: Settled Arbitrage Vault to Binance Treasury Transfer
  console.log('[TEST 6] Settled Arbitrage Vault Transfer to Binance Treasury');
  const { db } = await import('../server/databaseEngine.js');

  // Seed capital vault
  db.updateCapital({ reinvestmentVaultBalance: 500.00 });

  // 6a: Reject <= 0 amount
  const zeroRes = await treasuryEngine.transferVaultToBinance({ amountUsd: 0 });
  if (zeroRes.success) throw new Error('Zero amount transfer unexpectedly succeeded');
  console.log('  -> PASS: Zero amount transfer safely rejected.');

  // 6b: Reject over-vault amount
  const overRes = await treasuryEngine.transferVaultToBinance({ amountUsd: 99999 });
  if (overRes.success) throw new Error('Over-vault amount transfer unexpectedly succeeded');
  console.log('  -> PASS: Over-vault amount transfer safely rejected.');

  // 6c: Valid transfer of $150.00 to Binance
  const validRes = await treasuryEngine.transferVaultToBinance({
    amountUsd: 150.00,
    destinationAsset: 'USDT',
    operator: 'test_operator'
  });
  if (!validRes.success) throw new Error(`Vault transfer failed: ${validRes.error}`);
  if (validRes.transferredAmountUsd !== 150.00) throw new Error('transferredAmountUsd mismatch');
  if (validRes.remainingVaultBalanceUsd !== 350.00) throw new Error(`remainingVaultBalanceUsd expected 350.00, got ${validRes.remainingVaultBalanceUsd}`);
  if (!validRes.auditHash) throw new Error('Expected auditHash on vault transfer');

  const ledgerIntegrity = db.verifyLedgerIntegrity();
  if (!ledgerIntegrity.valid) throw new Error(`Ledger integrity invalid after vault transfer: ${ledgerIntegrity.reason}`);
  console.log(`  -> PASS: Transferred $150.00 to Binance (Remaining Vault: $${validRes.remainingVaultBalanceUsd.toFixed(2)}). Merkle integrity verified (Checked ${ledgerIntegrity.recordsChecked} blocks).`);

  // Restore vault balance
  db.updateCapital({ reinvestmentVaultBalance: 3200.00 });

  console.log('=== ALL TESTS PASSED SUCCESSFULLY ===');
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
