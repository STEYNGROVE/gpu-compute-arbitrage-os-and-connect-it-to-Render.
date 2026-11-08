import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { Pool } from 'pg';
import { ethers } from 'ethers';

const url = process.env.TEST_DATABASE_URL;
if (!url || process.env.ALLOW_ISOLATED_GPU_DB_TEST !== 'YES')
  throw Error('ISOLATED_TEST_OPT_IN_REQUIRED');

const parsed = new URL(url);
if (
  parsed.hostname !== '127.0.0.1' ||
  parsed.port !== '55439' ||
  parsed.pathname !== '/gpu_commercial_test' ||
  process.env.RENDER ||
  process.env.NODE_ENV === 'production'
) throw Error('UNSAFE_DATABASE_TARGET');

const schema = 'ledger_test_' + randomBytes(8).toString('hex');
const admin = new Pool({ connectionString: url });

const wallet = '0x1111111111111111111111111111111111111111';
const sender = '0x2222222222222222222222222222222222222222';
const token = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const hash = '0x' + 'a'.repeat(64);
const blockHash = '0x' + 'b'.repeat(64);
const topic = ethers.id('Transfer(address,address,uint256)');
const pad = (address: string) =>
  ethers.zeroPadValue(address, 32);

let minedAt = Math.floor(Date.now() / 1000);
let amount = ethers.parseUnits('2', 6);
let blockNumber = 100;

const server = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;

  const request = JSON.parse(body);
  const requests = Array.isArray(request) ? request : [request];

  const replies = requests.map((item: any) => {
    let result: any = null;

    switch (item.method) {
      case 'eth_chainId':
        result = '0x1';
        break;
      case 'eth_blockNumber':
        result = '0x78';
        break;
      case 'eth_getTransactionReceipt':
        result = {
          transactionHash: hash,
          transactionIndex: '0x0',
          blockHash,
          blockNumber: ethers.toBeHex(blockNumber),
          from: sender,
          to: token,
          cumulativeGasUsed: '0x5208',
          gasUsed: '0x5208',
          effectiveGasPrice: '0x1',
          logsBloom: '0x' + '0'.repeat(512),
          status: '0x1',
          type: '0x2',
          logs: [{
            address: token,
            topics: [topic, pad(sender), pad(wallet)],
            data: ethers.zeroPadValue(ethers.toBeHex(amount), 32),
            blockNumber: ethers.toBeHex(blockNumber),
            blockHash,
            transactionHash: hash,
            transactionIndex: '0x0',
            logIndex: '0x0',
            removed: false
          }]
        };
        break;
      case 'eth_getBlockByNumber':
        result = {
          number: ethers.toBeHex(blockNumber),
          hash: blockHash,
          parentHash: '0x' + 'c'.repeat(64),
          timestamp: ethers.toBeHex(minedAt),
          nonce: '0x0000000000000000',
          difficulty: '0x0',
          gasLimit: '0x1c9c380',
          gasUsed: '0x5208',
          miner: sender,
          extraData: '0x',
          transactions: []
        };
        break;
      default:
        result = null;
    }

    return {
      jsonrpc: '2.0',
      id: item.id,
      result
    };
  });

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(Array.isArray(request) ? replies : replies[0]));
});

let isolated: Pool | undefined;

try {
  await admin.query(`CREATE SCHEMA "${schema}"`);

  const testUrl = new URL(url);
  testUrl.searchParams.set('options', `-c search_path=${schema}`);

  process.env.DATABASE_URL = testUrl.toString();
  process.env.USDT_ERC20_RECEIVING_ADDRESS = wallet;

  await new Promise<void>(resolve =>
    server.listen(0, '127.0.0.1', resolve)
  );

  const address = server.address();
  if (!address || typeof address === 'string')
    throw Error('RPC_SERVER_FAILED');

  process.env.ETHEREUM_MAINNET_RPC_URL =
    `http://127.0.0.1:${address.port}`;

  const ledger = await import('../server/usdtInvoiceLedger.js');

  isolated = new Pool({ connectionString: testUrl.toString() });

  const first = await ledger.createUsdtInvoice('customer_a', '2', 60);
  const second = await ledger.createUsdtInvoice('customer_b', '2', 60);

  assert.equal(first.status, 'PENDING');
  assert.equal(second.status, 'PENDING');

  console.log('PASS: real invoice creation');

  // Ensure the simulated block timestamp falls inside the invoice window.
  const created = await isolated.query(
    'SELECT created_at FROM usdt_customer_invoices WHERE id=$1',
    [first.id]
  );

  minedAt = Math.ceil(
    new Date(created.rows[0].created_at).getTime() / 1000
  ) + 2;

  const result = await ledger.reconcileUsdtInvoice(first.id, hash);

  assert.equal(result.verified, true);
  assert.equal(result.status, 'INVOICE_PAID_ON_CHAIN');

  console.log('PASS: actual ledger reconciliation');

  const duplicate = await ledger.reconcileUsdtInvoice(second.id, hash);

  assert.equal(duplicate.verified, false);
  assert.equal(duplicate.status, 'TRANSFER_ALREADY_ALLOCATED');

  console.log('PASS: duplicate transfer rejected by actual ledger');

  const saved = await ledger.getUsdtInvoice(second.id);
  assert.equal(saved?.status, 'PENDING');

  console.log('PASS: second invoice remains unpaid');

  const replay = await ledger.reconcileUsdtInvoice(first.id, hash);
  assert.equal(replay.verified, false);
  assert.equal(replay.status, 'INVOICE_NOT_PENDING');

  console.log('PASS: replay rejected');

  // Expired invoice
  const expired = await ledger.createUsdtInvoice('expired_customer', '2', 60);
  await isolated.query(
    "UPDATE usdt_customer_invoices SET expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1",
    [expired.id]
  );
  const expiredResult = await ledger.reconcileUsdtInvoice(expired.id, hash);
  assert.equal(expiredResult.status, 'INVOICE_EXPIRED');
  assert.equal(expiredResult.verified, false);
  console.log('PASS: expired invoice rejected');

  // Incorrect transfer amount
  const wrongAmount = await ledger.createUsdtInvoice('wrong_amount', '3', 60);
  const wrongAmountResult = await ledger.reconcileUsdtInvoice(wrongAmount.id, hash);
  assert.equal(wrongAmountResult.status, 'USDT_TRANSFER_NOT_MATCHED');
  assert.equal(wrongAmountResult.verified, false);
  console.log('PASS: incorrect USDT amount rejected');

  // Historical payment
  const historical = await ledger.createUsdtInvoice('historical_customer', '2', 60);
  minedAt = Math.floor(new Date(historical.createdAt).getTime() / 1000) - 120;
  const historicalResult = await ledger.reconcileUsdtInvoice(historical.id, hash);
  assert.equal(historicalResult.status, 'TRANSFER_OUTSIDE_INVOICE_WINDOW');
  assert.equal(historicalResult.verified, false);
  console.log('PASS: historical payment rejected');

  minedAt = Math.floor(Date.now() / 1000) + 2;

  // Concurrent replay attempts
  const concurrent = await ledger.createUsdtInvoice('concurrent_customer', '2', 60);
  const claims = await Promise.all([
    ledger.reconcileUsdtInvoice(concurrent.id, hash),
    ledger.reconcileUsdtInvoice(concurrent.id, hash)
  ]);
  assert.equal(claims.every(x => x.verified === false), true);
  assert.equal((await ledger.getUsdtInvoice(concurrent.id))?.status, 'PENDING');
  console.log('PASS: concurrent replay attempts rejected');

  // Receiving wallet changed
  const wrongWallet = await ledger.createUsdtInvoice('wallet_customer', '2', 60);
  process.env.USDT_ERC20_RECEIVING_ADDRESS =
    '0x3333333333333333333333333333333333333333';

  try {
    const walletResult = await ledger.reconcileUsdtInvoice(wrongWallet.id, hash);
    assert.equal(walletResult.status, 'WALLET_CONFIGURATION_CHANGED');
    assert.equal(walletResult.verified, false);
    console.log('PASS: receiving wallet mismatch rejected');
  } finally {
    process.env.USDT_ERC20_RECEIVING_ADDRESS = wallet;
  }

  assert.equal(result.purchasingUnlocked, false);
  assert.equal(result.treasuryCredited, false);
  console.log('PASS: purchasing and treasury remain locked');

  console.log('ACTUAL USDT LEDGER INTEGRATION TEST PASSED');

} finally {
  await isolated?.end();

  await new Promise<void>(resolve => server.close(() => resolve()));

  // Close the application's PostgreSQL pool before dropping its schema.
  // The process exits after cleanup; no production database is involved.
  await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.end();
  // Allow Node to report assertion failures naturally.
  // The ledger pool may keep the event loop open; the test runner
  // should use an explicit timeout rather than force success.
}
