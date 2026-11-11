import { PayFastPaymentProvider } from '../server/payfastProvider.js';
import assert from 'node:assert/strict';
import express from 'express';
import { financialLockdown } from '../server/financialLockdown.js';
import { PaymentEngine, BinancePaymentProvider } from '../server/paymentEngine.js';
import { pgDbService } from '../server/pgDatabase.js';
import { paymentRepo, settlementRepo } from '../server/repositories/index.js';
import { treasuryEngine } from '../server/treasuryEngine.js';
import { verifiedProfitWithdrawalService } from '../server/verifiedProfitWithdrawalService.js';
import { binanceTreasuryProvider } from '../server/binanceProvider.js';
import { hardwareProvisioner } from '../server/providerProvisioner.js';
import { hotWalletService } from '../server/hotWalletService.js';
import { db } from '../server/databaseEngine.js';

async function main() {
  const modes = ['SYSTEM_OPERATING_MODE', 'EXECUTION_MODE', 'REALITY_LEVEL'];
  const originals = modes.map(key => process.env[key]);
  const connected = pgDbService.isLiveDatabaseConnected;
  const query = pgDbService.query;
  const client = pgDbService.getClient;
  const network = globalThis.fetch;
  let sideEffects = 0;
  const unexpected = async (): Promise<never> => {
    sideEffects++;
    throw new Error('Unexpected database or network access');
  };
  try {
    // A healthy database and explicit LIVE flags must never authorize money movement.
    modes.forEach(key => { process.env[key] = 'LIVE'; });
    pgDbService.isLiveDatabaseConnected = () => true;
    pgDbService.query = unexpected;
    pgDbService.getClient = unexpected;
    globalThis.fetch = unexpected;
    const beforeCapital = JSON.stringify(db.getCapital());
    const beforeLedger = JSON.stringify(db.getLedger());
    for (const provider of [new BinancePaymentProvider(), new PayFastPaymentProvider()]) {
      const result = await provider.createPaymentIntent(undefined as never);
      assert.equal(result.success, false);
      assert.match(result.error!, /SIMULATION_LOCKDOWN/);
    }
    const engine = new PaymentEngine();
    const intent = await engine.createIntent({ customerId: 'customer', provider: 'BINANCE', amountMajor: 10, currency: 'USD' });
    assert.equal(intent.success, false);
    assert.match(intent.error!, /SIMULATION_LOCKDOWN/);
    const payment = await engine.verifyPayment({ intentId: 'intent' });
    assert.equal(payment.errorCode, 'SIMULATION_LOCKDOWN');
    await assert.rejects(paymentRepo.settlePaymentAtomic(undefined as never), /SIMULATION_LOCKDOWN/);
    await assert.rejects(settlementRepo.settleJobAtomic(undefined as never), /SIMULATION_LOCKDOWN/);
    const transfer = await treasuryEngine.transferVaultToBinance({ amountUsd: 150 });
    assert.equal(transfer.success, false);
    assert.match(transfer.error!, /SIMULATION_LOCKDOWN/);
    await assert.rejects(treasuryEngine.restoreVaultBalance({ amountUsd: 3200 }), /SIMULATION_LOCKDOWN/);
    const profits = await verifiedProfitWithdrawalService.syncRealizedProfitsToWithdrawable();
    assert.equal(profits.syncedCount, 0);
    const withdrawal = await verifiedProfitWithdrawalService.executeVerifiedProfitWithdrawal(undefined as never);
    assert.equal(withdrawal.success, false);
    assert.match(withdrawal.error!, /SIMULATION_LOCKDOWN/);
    const internal = await verifiedProfitWithdrawalService.sendProfitsToInternalHot();
    assert.equal(internal.success, false);
    assert.match(internal.error!, /SIMULATION_LOCKDOWN/);
    await assert.rejects(hardwareProvisioner.provisionComputeHardware(undefined as never), /SIMULATION_LOCKDOWN/);
    await assert.rejects(hardwareProvisioner.terminateComputeHardware('vast_ai', 'instance'), /SIMULATION_LOCKDOWN/);
    await assert.rejects(hotWalletService.withdrawToBinance(undefined as never), /SIMULATION_LOCKDOWN/);
    for (const method of ['POST', 'DELETE'] as const) {
      await assert.rejects(binanceTreasuryProvider.request('/api/v3/order', { method }), /SIMULATION_LOCKDOWN/);
    }
    assert.equal(sideEffects, 0, 'Blocked calls must not access the database or network');
    assert.equal(JSON.stringify(db.getCapital()), beforeCapital);
    assert.equal(JSON.stringify(db.getLedger()), beforeLedger);
    console.log('PASS: Connected-database LIVE configuration cannot provision, trade, settle, restore capital or withdraw; zero side effects');
  } finally {
    pgDbService.isLiveDatabaseConnected = connected;
    pgDbService.query = query;
    pgDbService.getClient = client;
    globalThis.fetch = network;
    modes.forEach((key, i) => {
      if (originals[i] === undefined) delete process.env[key];
      else process.env[key] = originals[i];
    });
  }

  const app = express();
  let reached = 0;
  app.use('/api', financialLockdown);
  app.use((_req, res) => { reached++; res.sendStatus(204); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const address = server.address();
    assert(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    for (const path of ['/payments/intent', '/PAYMENTS/VERIFY/', '/webhooks/escrow', '/webhooks/binance', '/webhooks/treasury/bank-deposit', '/compute/settle-deal', '/TREASURY/vault/restore', '/provisioning/preflight', '/capital/fund-tranche', '/autonomous/deploy']) {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const res = await fetch(base + '/api' + path, { method });
        assert.equal(res.status, 423, `${method} ${path}`);
      }
    }
    assert.equal(reached, 0, 'Financial handlers must never be reached');
    assert.equal((await fetch(base + '/api/treasury/status')).status, 204);
    assert.equal((await fetch(base + '/api/commercial/enquiry', { method: 'POST' })).status, 204);
    assert.equal((await fetch(base + '/api/kill-switch/engage', { method: 'POST' })).status, 204);
    console.log('PASS: 40 HTTP write variants blocked; read-only, enquiry and emergency-stop paths preserved');
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
