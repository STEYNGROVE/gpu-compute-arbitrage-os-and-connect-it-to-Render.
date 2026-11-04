import http from 'http';
import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import {
  hotWalletService,
  SUPPORTED_NETWORKS,
  OFFICIAL_BSC_USDT_CONTRACT,
  OFFICIAL_BSC_CHAIN_ID
} from '../server/hotWalletService.js';
import { verifiedProfitWithdrawalService } from '../server/verifiedProfitWithdrawalService.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName} - ${details || 'Assertion failed'}`);
    process.exitCode = 1;
  }
}

interface MockRpcNodeConfig {
  chainId: number;
  blockNumber: number;
  blockTimestampSec: () => number;
  delayMs: number;
  shouldFailAll: boolean;
  bnbBalanceWei: bigint;
  usdtBalanceUnits: bigint;
  usdtBytecode: string;
  usdtDecimals: number;
  usdtSymbol: string;
  latestNonce: number;
  pendingNonce: number;
  failSendRawTxWithError: string | null;
  timeoutSendRawTx: boolean;
  returnNullReceipt: boolean;
  receiptStatus: number;
  broadcastedTxs: Map<string, { rawTx: string; from: string; to: string; nonce: number; blockNumber: number }>;
  sendRawTxCallCount: number;
}

function createDefaultNodeConfig(): MockRpcNodeConfig {
  return {
    chainId: 56,
    blockNumber: 42500000,
    blockTimestampSec: () => Math.floor(Date.now() / 1000) - 2,
    delayMs: 0,
    shouldFailAll: false,
    bnbBalanceWei: ethers.parseUnits('0.25', 18), // 0.25 BNB (>= 0.005 min gas reserve)
    usdtBalanceUnits: ethers.parseUnits('2500.00', 18), // 2,500 USDT
    usdtBytecode: '0x6080604052600436106100b95760003560e01c8063313ce5671461012057',
    usdtDecimals: 18,
    usdtSymbol: 'USDT',
    latestNonce: 5,
    pendingNonce: 5,
    failSendRawTxWithError: null,
    timeoutSendRawTx: false,
    returnNullReceipt: false,
    receiptStatus: 1,
    broadcastedTxs: new Map(),
    sendRawTxCallCount: 0
  };
}

async function startLocalJsonRpcServer(config: MockRpcNodeConfig): Promise<{
  url: string;
  server: http.Server;
  config: MockRpcNodeConfig;
  close: () => Promise<void>;
}> {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  const handleSingleRpc = async (reqObj: any): Promise<any> => {
    const { id, method, params = [] } = reqObj;

    if (config.delayMs > 0) {
      await new Promise(r => setTimeout(r, config.delayMs));
    }

    if (config.shouldFailAll) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: 'RPC node internal error / offline' }
      };
    }

    switch (method) {
      case 'eth_chainId':
        return { jsonrpc: '2.0', id, result: '0x' + config.chainId.toString(16) };

      case 'net_version':
        return { jsonrpc: '2.0', id, result: String(config.chainId) };

      case 'eth_blockNumber':
        return { jsonrpc: '2.0', id, result: '0x' + config.blockNumber.toString(16) };

      case 'eth_getBlockByNumber': {
        const tsHex = '0x' + Math.max(0, config.blockTimestampSec()).toString(16);
        const blkNumHex = '0x' + config.blockNumber.toString(16);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            number: blkNumHex,
            hash: '0x' + 'a'.repeat(64),
            parentHash: '0x' + 'b'.repeat(64),
            nonce: '0x0000000000000000',
            sha3Uncles: '0x' + 'c'.repeat(64),
            logsBloom: '0x' + '0'.repeat(512),
            transactionsRoot: '0x' + 'd'.repeat(64),
            stateRoot: '0x' + 'e'.repeat(64),
            receiptsRoot: '0x' + 'f'.repeat(64),
            miner: '0x0000000000000000000000000000000000000000',
            difficulty: '0x1',
            totalDifficulty: '0x1',
            extraData: '0x',
            size: '0x3e8',
            gasLimit: '0x1c9c380',
            gasUsed: '0x5208',
            timestamp: tsHex,
            transactions: [],
            uncles: []
          }
        };
      }

      case 'eth_getBalance':
        return { jsonrpc: '2.0', id, result: '0x' + config.bnbBalanceWei.toString(16) };

      case 'eth_getCode': {
        const targetAddr = String(params[0] || '').toLowerCase();
        if (targetAddr === OFFICIAL_BSC_USDT_CONTRACT.toLowerCase()) {
          return { jsonrpc: '2.0', id, result: config.usdtBytecode };
        }
        return { jsonrpc: '2.0', id, result: '0x' };
      }

      case 'eth_call': {
        const callObj = params[0] || {};
        const data = String(callObj.data || '').toLowerCase();
        if (data.startsWith('0x313ce567')) {
          // decimals()
          return { jsonrpc: '2.0', id, result: abiCoder.encode(['uint8'], [config.usdtDecimals]) };
        }
        if (data.startsWith('0x95d89b41')) {
          // symbol()
          return { jsonrpc: '2.0', id, result: abiCoder.encode(['string'], [config.usdtSymbol]) };
        }
        if (data.startsWith('0x70a08231')) {
          // balanceOf(address)
          return { jsonrpc: '2.0', id, result: abiCoder.encode(['uint256'], [config.usdtBalanceUnits]) };
        }
        return { jsonrpc: '2.0', id, result: '0x' };
      }

      case 'eth_getTransactionCount': {
        const tag = String(params[1] || 'latest').toLowerCase();
        const nonceVal = tag === 'pending' ? config.pendingNonce : config.latestNonce;
        return { jsonrpc: '2.0', id, result: '0x' + nonceVal.toString(16) };
      }

      case 'eth_gasPrice':
        return { jsonrpc: '2.0', id, result: '0xb2d05e00' }; // 3 gwei

      case 'eth_sendRawTransaction': {
        config.sendRawTxCallCount++;
        if (config.timeoutSendRawTx) {
          await new Promise(r => setTimeout(r, 2500));
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32000, message: 'RPC_TIMEOUT during eth_sendRawTransaction' }
          };
        }
        if (config.failSendRawTxWithError) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32000, message: config.failSendRawTxWithError }
          };
        }
        const rawTx = String(params[0]);
        const txHash = ethers.keccak256(rawTx);
        const parsedTx = ethers.Transaction.from(rawTx);
        config.broadcastedTxs.set(txHash.toLowerCase(), {
          rawTx,
          from: parsedTx.from || '0x0000000000000000000000000000000000000000',
          to: parsedTx.to || OFFICIAL_BSC_USDT_CONTRACT,
          nonce: parsedTx.nonce,
          blockNumber: config.blockNumber
        });
        config.latestNonce = Math.max(config.latestNonce, parsedTx.nonce + 1);
        config.pendingNonce = Math.max(config.pendingNonce, parsedTx.nonce + 1);
        return { jsonrpc: '2.0', id, result: txHash };
      }

      case 'eth_getTransactionByHash': {
        const txHash = String(params[0] || '').toLowerCase();
        const stored = config.broadcastedTxs.get(txHash);
        if (!stored) {
          return { jsonrpc: '2.0', id, result: null };
        }
        return {
          jsonrpc: '2.0',
          id,
          result: {
            hash: txHash,
            blockHash: '0x' + 'a'.repeat(64),
            blockNumber: '0x' + stored.blockNumber.toString(16),
            from: stored.from,
            to: stored.to,
            value: '0x0',
            nonce: '0x' + stored.nonce.toString(16),
            gas: '0x186a0',
            gasPrice: '0xb2d05e00',
            input: '0x',
            transactionIndex: '0x0',
            v: '0x93',
            r: '0x' + '1'.repeat(64),
            s: '0x' + '2'.repeat(64)
          }
        };
      }

      case 'eth_getTransactionReceipt': {
        if (config.returnNullReceipt) {
          return { jsonrpc: '2.0', id, result: null };
        }
        const txHash = String(params[0] || '').toLowerCase();
        const stored = config.broadcastedTxs.get(txHash);
        if (!stored) {
          return { jsonrpc: '2.0', id, result: null };
        }
        return {
          jsonrpc: '2.0',
          id,
          result: {
            transactionHash: txHash,
            transactionIndex: '0x0',
            blockHash: '0x' + 'a'.repeat(64),
            blockNumber: '0x' + stored.blockNumber.toString(16),
            from: stored.from,
            to: stored.to,
            cumulativeGasUsed: '0xcadc',
            gasUsed: '0xcadc',
            effectiveGasPrice: '0xb2d05e00',
            contractAddress: null,
            logs: [],
            logsBloom: '0x' + '0'.repeat(512),
            status: '0x' + config.receiptStatus.toString(16),
            type: '0x0'
          }
        };
      }

      default:
        return { jsonrpc: '2.0', id, result: null };
    }
  };

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        if (Array.isArray(parsed)) {
          const results = await Promise.all(parsed.map(item => handleSingleRpc(item)));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(results));
        } else {
          const result = await handleSingleRpc(parsed);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        }
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
      }
    });
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const url = `http://127.0.0.1:${addr.port}`;

  return {
    url,
    server,
    config,
    close: () => new Promise<void>(resolve => server.close(() => resolve()))
  };
}

async function runHotWalletTestSuite() {
  console.log('================================================================');
  console.log('  BNB SMART CHAIN (BSC) TREASURY & RPC HARDENING TEST SUITE     ');
  console.log('================================================================');

  const origKey = process.env.TREASURY_HOT_WALLET_PRIVATE_KEY;
  const origNet = process.env.TREASURY_HOT_WALLET_NETWORK;
  const origRpc = process.env.BSC_RPC_URL;
  const origFallbacks = process.env.BSC_RPC_FALLBACK_URLS;
  const origTimeout = process.env.BSC_RPC_TIMEOUT_MS;
  const origMaxBlockAge = process.env.BSC_RPC_MAX_BLOCK_AGE_SECONDS;
  const origReceiptTimeout = process.env.BSC_RECEIPT_TIMEOUT_MS;
  const origMinGas = process.env.TREASURY_MIN_GAS_RESERVE_BNB;
  const origNodeEnv = process.env.NODE_ENV;
  const origUsdtEnv = process.env.BSC_USDT_CONTRACT_ADDRESS;

  const primaryNode = await startLocalJsonRpcServer(createDefaultNodeConfig());
  const fallback1Node = await startLocalJsonRpcServer(createDefaultNodeConfig());
  const fallback2Node = await startLocalJsonRpcServer(createDefaultNodeConfig());

  try {
    process.env.BSC_RPC_TIMEOUT_MS = '600';
    process.env.BSC_RPC_MAX_BLOCK_AGE_SECONDS = '60';
    process.env.BSC_RECEIPT_TIMEOUT_MS = '800';
    process.env.TREASURY_MIN_GAS_RESERVE_BNB = '0.005';

    // -------------------------------------------------------------------------
    // TEST 1: Remove Hardcoded Production RPCs & Verify Env Configuration
    // -------------------------------------------------------------------------
    console.log('\n--- 1. REMOVE HARDCODED RPCs & ENVIRONMENT CONFIGURATION ---');
    const hotWalletSource = fs.readFileSync(path.join(process.cwd(), 'server', 'hotWalletService.ts'), 'utf8');
    const setupScriptSource = fs.readFileSync(path.join(process.cwd(), 'scripts', 'setupTreasuryWallet.ts'), 'utf8');
    const forbiddenPublicRpcs = [
      'https://bsc-dataseed1.binance.org',
      'https://bsc-dataseed2.binance.org',
      'https://bsc-dataseed3.binance.org',
      'https://bsc.publicnode.com',
      'https://binance.llamarpc.com'
    ];
    for (const forbiddenUrl of forbiddenPublicRpcs) {
      assert(!hotWalletSource.includes(forbiddenUrl), `hotWalletService.ts has removed hardcoded RPC ${forbiddenUrl}`);
      assert(!setupScriptSource.includes(forbiddenUrl), `setupTreasuryWallet.ts has removed hardcoded RPC ${forbiddenUrl}`);
    }
    assert(SUPPORTED_NETWORKS.BSC.rpcUrls.length === 0, 'SUPPORTED_NETWORKS.BSC.rpcUrls contains 0 hardcoded URLs');
    assert(hotWalletService.getMinGasReserveBnb() === 0.005, 'TREASURY_MIN_GAS_RESERVE_BNB defaults to 0.005 BNB');

    // Configure BSC_RPC_URL and BSC_RPC_FALLBACK_URLS
    process.env.BSC_RPC_URL = `${primaryNode.url}/v3/super_secret_api_key_token_123456?apikey=secret999`;
    process.env.BSC_RPC_FALLBACK_URLS = `${fallback1Node.url}, ${fallback2Node.url}`;

    const configuredEndpoints = hotWalletService.getConfiguredRpcEndpoints();
    assert(configuredEndpoints.length === 3, 'Parses BSC_RPC_URL (primary) and comma-separated BSC_RPC_FALLBACK_URLS (2 fallbacks)');
    assert(configuredEndpoints[0].role === 'PRIMARY', 'First endpoint is marked PRIMARY');
    assert(configuredEndpoints[1].role === 'FALLBACK' && configuredEndpoints[2].role === 'FALLBACK', 'Subsequent endpoints are marked FALLBACK');
    assert(!configuredEndpoints[0].redactedUrl.includes('super_secret_api_key_token_123456') && !configuredEndpoints[0].redactedUrl.includes('secret999'), 'Redacts private RPC path tokens and query credentials');

    // -------------------------------------------------------------------------
    // TEST 2: Zero-Trust Configuration & Fail-Closed on Missing Key
    // -------------------------------------------------------------------------
    console.log('\n--- 2. ZERO-TRUST CONFIGURATION & FAIL-CLOSED INITIALIZATION ---');
    delete process.env.TREASURY_HOT_WALLET_PRIVATE_KEY;
    const nullWallet = hotWalletService.initWallet();
    assert(nullWallet === null, 'Missing TREASURY_HOT_WALLET_PRIVATE_KEY results in null wallet (fails closed)');
    assert(hotWalletService.isConfigured() === false, 'isConfigured returns false when private key is omitted');

    const unconfiguredStatus = await hotWalletService.getFullStatus();
    assert(unconfiguredStatus.status === 'UNCONFIGURED', 'Full status indicates UNCONFIGURED status');
    assert(unconfiguredStatus.networkDetails.rpcUrls.length === 0, 'Frontend-facing networkDetails never exposes RPC URLs');

    // -------------------------------------------------------------------------
    // TEST 3: Deterministic Wallet & Secret Rotation
    // -------------------------------------------------------------------------
    console.log('\n--- 3. DETERMINISTIC IN-MEMORY WALLET & SECRET ROTATION ---');
    const testSecret1 = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
    process.env.TREASURY_HOT_WALLET_PRIVATE_KEY = testSecret1;
    process.env.TREASURY_HOT_WALLET_NETWORK = 'BSC';

    const wallet1 = hotWalletService.initWallet();
    const expectedAddress1 = ethers.computeAddress(testSecret1);
    assert(wallet1 !== null && hotWalletService.getAddress() === expectedAddress1, `Derived address matches expected: ${expectedAddress1}`);

    const testSecret2 = '0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1';
    process.env.TREASURY_HOT_WALLET_PRIVATE_KEY = testSecret2;
    hotWalletService.initWallet();
    const expectedAddress2 = ethers.computeAddress(testSecret2);
    assert(hotWalletService.getAddress() === expectedAddress2, `Secret rotation detected: new address derived (${expectedAddress2})`);

    // -------------------------------------------------------------------------
    // TEST 4: Primary RPC Success & Health Monitoring
    // -------------------------------------------------------------------------
    console.log('\n--- 4. PRIMARY RPC SUCCESS & HEALTH MONITORING ---');
    process.env.BSC_RPC_URL = primaryNode.url;
    process.env.BSC_RPC_FALLBACK_URLS = `${fallback1Node.url},${fallback2Node.url}`;
    hotWalletService.resetRpcAndNonceStateForTesting();

    const primaryConn = await hotWalletService.getProvider('BSC');
    assert(primaryConn.role === 'PRIMARY', 'Selects PRIMARY RPC when healthy');
    assert(primaryConn.chainId === OFFICIAL_BSC_CHAIN_ID, 'Verified Chain ID === 56');
    assert(primaryConn.latestBlock === 42500000, 'Verified latest block number from PRIMARY RPC');
    assert(primaryConn.blockAge <= 60, `Verified fresh block age (${primaryConn.blockAge}s <= 60s)`);

    const healthState = hotWalletService.getRpcHealthState();
    assert(healthState.healthStatus === 'HEALTHY', 'Overall RPC health status is HEALTHY');
    assert(healthState.currentActiveEndpoint === primaryNode.url, 'currentActiveEndpoint matches PRIMARY RPC');
    assert(healthState.chainId === 56 && healthState.latestBlock === 42500000, 'Health state tracks chainId and latestBlock');
    assert(typeof healthState.latency === 'number' && healthState.latency >= 0, 'Health state tracks latency');
    assert(healthState.consecutiveFailures === 0, 'Health state tracks consecutiveFailures === 0');
    assert(Boolean(healthState.lastSuccessfulCheck), 'Health state records lastSuccessfulCheck ISO timestamp');

    // -------------------------------------------------------------------------
    // TEST 5: Primary RPC Timeout & Deterministic Failover to Fallback #1
    // -------------------------------------------------------------------------
    console.log('\n--- 5. PRIMARY RPC TIMEOUT & DETERMINISTIC FAILOVER ---');
    primaryNode.config.delayMs = 1200; // Exceeds BSC_RPC_TIMEOUT_MS (600ms)
    const failoverConn = await hotWalletService.getProvider('BSC');
    assert(failoverConn.role === 'FALLBACK', 'Automatically fails over to FALLBACK #1 when PRIMARY times out');
    assert(failoverConn.rawRpcUrl === fallback1Node.url, 'Active endpoint is FALLBACK #1');

    const degradedHealth = hotWalletService.getRpcHealthState();
    assert(degradedHealth.healthStatus === 'DEGRADED', 'Health status transitions to DEGRADED when running on fallback');
    const primaryEndpointHealth = degradedHealth.endpoints.find(e => e.role === 'PRIMARY');
    assert(Boolean(primaryEndpointHealth && primaryEndpointHealth.consecutiveFailures >= 1), 'PRIMARY endpoint increments consecutiveFailures on timeout');
    assert(Boolean(primaryEndpointHealth?.lastError?.includes('RPC_TIMEOUT')), 'PRIMARY endpoint records RPC_TIMEOUT error');
    primaryNode.config.delayMs = 0;

    // -------------------------------------------------------------------------
    // TEST 6: All RPCs Unavailable -> Strict Fail-Closed
    // -------------------------------------------------------------------------
    console.log('\n--- 6. ALL RPCs UNAVAILABLE (FAIL-CLOSED) ---');
    primaryNode.config.shouldFailAll = true;
    fallback1Node.config.shouldFailAll = true;
    fallback2Node.config.shouldFailAll = true;

    let allFailedThrown = false;
    try {
      await hotWalletService.getProvider('BSC');
    } catch (err: any) {
      allFailedThrown = err.message.includes('TREASURY_RPC_UNAVAILABLE');
    }
    assert(allFailedThrown, 'Throws TREASURY_RPC_UNAVAILABLE when all RPC endpoints fail');

    const unavailBalances = await hotWalletService.getLiveBalances('BSC');
    assert(unavailBalances.rpcAvailable === false && unavailBalances.balanceVerified === false, 'No balance claim when all RPCs fail (balanceVerified=false)');
    assert(unavailBalances.canWithdraw === false, 'Withdrawals strictly disabled when all RPCs fail');

    const unavailReadiness = await hotWalletService.checkTreasuryReadiness();
    assert(unavailReadiness.ready === false && unavailReadiness.checks.bscRpcReachable === false, 'Autonomous treasury readiness fails closed when all RPCs fail');

    primaryNode.config.shouldFailAll = false;
    fallback1Node.config.shouldFailAll = false;
    fallback2Node.config.shouldFailAll = false;

    // -------------------------------------------------------------------------
    // TEST 7: Wrong Chain ID & BSC Testnet Rejection & Stale Block Rejection
    // -------------------------------------------------------------------------
    console.log('\n--- 7. WRONG CHAIN ID, BSC TESTNET & STALE BLOCK REJECTION ---');
    // 7a. Ethereum Mainnet (Chain ID 1)
    primaryNode.config.chainId = 1;
    const ethCheck = await hotWalletService.validateRpcEndpoint(primaryNode.url, 'PRIMARY');
    assert(ethCheck.valid === false && Boolean(ethCheck.error?.includes('WRONG_CHAIN_ID')), 'Rejects Ethereum Mainnet (Chain ID 1)');

    // 7b. Polygon (Chain ID 137)
    primaryNode.config.chainId = 137;
    const polyCheck = await hotWalletService.validateRpcEndpoint(primaryNode.url, 'PRIMARY');
    assert(polyCheck.valid === false && Boolean(polyCheck.error?.includes('WRONG_CHAIN_ID')), 'Rejects Polygon Mainnet (Chain ID 137)');

    // 7c. BSC Testnet (Chain ID 97)
    primaryNode.config.chainId = 97;
    const testnetCheck = await hotWalletService.validateRpcEndpoint(primaryNode.url, 'PRIMARY');
    assert(testnetCheck.valid === false && Boolean(testnetCheck.error?.includes('BSC_TESTNET_REJECTED')), 'Rejects BSC Testnet (Chain ID 97)');
    primaryNode.config.chainId = 56;

    // 7d. Stale Block Rejection (block age > 60s)
    const origTsFn = primaryNode.config.blockTimestampSec;
    primaryNode.config.blockTimestampSec = () => Math.floor(Date.now() / 1000) - 300; // 300s old
    const staleCheck = await hotWalletService.validateRpcEndpoint(primaryNode.url, 'PRIMARY');
    assert(staleCheck.valid === false && Boolean(staleCheck.error?.includes('STALE_BLOCK_REJECTED')), 'Rejects RPC returning stale block timestamp (300s > 60s)');
    primaryNode.config.blockTimestampSec = origTsFn;

    // 7e. Production HTTPS-only enforcement
    process.env.NODE_ENV = 'production';
    const httpInProdCheck = await hotWalletService.validateRpcEndpoint(primaryNode.url, 'PRIMARY');
    assert(httpInProdCheck.valid === false && Boolean(httpInProdCheck.error?.includes('INSECURE_RPC_PROTOCOL')), 'Rejects non-HTTPS RPC endpoint when NODE_ENV=production');
    process.env.NODE_ENV = 'test';

    // -------------------------------------------------------------------------
    // TEST 8: BSC USDT Contract Validation (0x55d398326f99059fF775485246999027B3197955)
    // -------------------------------------------------------------------------
    console.log('\n--- 8. BSC USDT CONTRACT VALIDATION ---');
    const { provider: validProv } = await hotWalletService.getProvider('BSC');
    const validUsdt = await hotWalletService.validateUsdtContract(validProv);
    assert(validUsdt.valid === true && validUsdt.contractAddress === OFFICIAL_BSC_USDT_CONTRACT, 'Validates official BSC USDT contract (0x55d3...7955)');

    let rogueContractRejected = false;
    try {
      await hotWalletService.validateUsdtContract(validProv, '0x1111111111111111111111111111111111111111');
    } catch (err: any) {
      rogueContractRejected = err.message.includes('UNAUTHORIZED_USDT_CONTRACT');
    }
    assert(rogueContractRejected, 'Blocks attempt to redirect treasury operations to an unauthorized token contract');

    primaryNode.config.usdtBytecode = '0x';
    let emptyCodeRejected = false;
    try {
      await hotWalletService.validateUsdtContract(validProv);
    } catch (err: any) {
      emptyCodeRejected = err.message.includes('USDT_CONTRACT_NOT_DEPLOYED');
    }
    assert(emptyCodeRejected, 'Rejects when USDT contract bytecode is missing on connected chain');
    primaryNode.config.usdtBytecode = '0x6080604052600436106100b95760003560e01c8063313ce5671461012057';

    // -------------------------------------------------------------------------
    // TEST 9: Allowlist, Cooldown, Limits, Gas Reserve & Full 16-Step Transaction Confirmation
    // -------------------------------------------------------------------------
    console.log('\n--- 9. 16-STEP TRANSACTION SAFETY, COOLDOWN, CONFIRMATION & POST-TX RECONCILIATION ---');
    verifiedProfitWithdrawalService.resetInMemoryAllowlist();
    const approvedDest = '0x742d35cc6634c0532925a3b844bc454e4438f44e';
    await verifiedProfitWithdrawalService.addAllowlistAddress({
      destinationAddress: approvedDest,
      network: 'BSC',
      coin: 'USDT',
      label: 'Authorized Cold Storage Vault',
      approvedBy: 'security_officer'
    });

    // Newly added withdrawal address must be blocked during mandatory 24-hour security cooldown
    const cooldownBlockRes = await hotWalletService.withdrawToBinance({
      amountUsd: 25.00,
      destinationAddress: approvedDest,
      networkId: 'BSC',
      operator: 'test_operator'
    });
    assert(
      cooldownBlockRes.success === false && Boolean(cooldownBlockRes.message.includes('DESTINATION_COOLDOWN_ACTIVE')),
      'Rejects immediate withdrawal to newly allowlisted address during 24-hour security cooldown'
    );

    // Mature the allowlisted address past the 24-hour cooldown window
    await verifiedProfitWithdrawalService.addAllowlistAddress({
      destinationAddress: approvedDest,
      network: 'BSC',
      coin: 'USDT',
      label: 'Authorized Cold Storage Vault',
      approvedBy: 'security_officer',
      createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    });

    // Test Insufficient BNB Gas (< 0.005 BNB)
    primaryNode.config.bnbBalanceWei = ethers.parseUnits('0.002', 18); // 0.002 < 0.005 required
    const lowGasRes = await hotWalletService.withdrawToBinance({
      amountUsd: 25.00,
      destinationAddress: approvedDest,
      networkId: 'BSC',
      operator: 'test_operator'
    });
    assert(lowGasRes.success === false && lowGasRes.errorDetails === 'INSUFFICIENT_GAS', 'Rejects withdrawal when BNB gas is below 0.005 BNB reserve (0.002 BNB)');
    primaryNode.config.bnbBalanceWei = ethers.parseUnits('0.25', 18);

    // Execute full 16-step confirmed transaction
    hotWalletService.resetRpcAndNonceStateForTesting();
    const confirmedRes = await hotWalletService.withdrawToBinance({
      amountUsd: 100.00,
      destinationAddress: approvedDest,
      networkId: 'BSC',
      idempotencyKey: 'idemp_confirmed_tx_1',
      operator: 'test_operator'
    });
    assert(confirmedRes.success === true && confirmedRes.state === 'CONFIRMED', '16-step transaction completes and reaches CONFIRMED state');
    assert(Boolean(confirmedRes.txHash && confirmedRes.txHash.startsWith('0x')), `Recorded real signed transaction hash: ${confirmedRes.txHash}`);
    assert((confirmedRes.confirmationCount || 0) >= 1, 'Verified transaction confirmations >= 1');
    assert(confirmedRes.reconciledAfterTx === true && confirmedRes.reconciliationReport?.discrepancyDetected === false, 'Automatically reconciled treasury with blockchain after transaction completion');

    // -------------------------------------------------------------------------
    // TEST 10: Duplicate Transaction Prevention (Idempotency & Replay)
    // -------------------------------------------------------------------------
    console.log('\n--- 10. DUPLICATE TRANSACTION PREVENTION ---');
    const prevSendCount = primaryNode.config.sendRawTxCallCount;
    const replayRes = await hotWalletService.withdrawToBinance({
      amountUsd: 100.00,
      destinationAddress: approvedDest,
      networkId: 'BSC',
      idempotencyKey: 'idemp_confirmed_tx_1',
      operator: 'test_operator'
    });
    assert(replayRes.txHash === confirmedRes.txHash, 'Duplicate idempotencyKey returns original confirmed transaction hash');
    assert(primaryNode.config.sendRawTxCallCount === prevSendCount, 'Duplicate request does NOT broadcast a second transaction');

    // -------------------------------------------------------------------------
    // TEST 11: Mid-Transaction RPC Switching (Safe Failover Without Duplicate Broadcast)
    // -------------------------------------------------------------------------
    console.log('\n--- 11. MID-TRANSACTION RPC SWITCHING (SAFE FAILOVER) ---');
    // Case A: Primary RPC times out during eth_sendRawTransaction without broadcasting; Fallback #1 checks chain state and safely broadcasts once
    primaryNode.config.timeoutSendRawTx = true;
    fallback1Node.config.latestNonce = primaryNode.config.latestNonce;
    fallback1Node.config.pendingNonce = primaryNode.config.pendingNonce;
    const fbSendBefore = fallback1Node.config.sendRawTxCallCount;

    const switchedRes = await hotWalletService.withdrawToBinance({
      amountUsd: 50.00,
      destinationAddress: approvedDest,
      networkId: 'BSC',
      idempotencyKey: 'idemp_rpc_switch_1',
      operator: 'test_operator'
    });
    assert(switchedRes.success === true && switchedRes.state === 'CONFIRMED', 'Transaction succeeds via Fallback #1 after Primary RPC fails mid-broadcast');
    assert(switchedRes.rpcSwitched === true, 'Transaction record flags rpcSwitched === true');
    assert(fallback1Node.config.sendRawTxCallCount === fbSendBefore + 1, 'Fallback #1 broadcasted the signed transaction exactly once');

    // Case B: Primary RPC DID broadcast the tx before connection dropped; Fallback #1 sees tx already on-chain and does NOT resend!
    const preSeededWallet = hotWalletService.initWallet()!;
    const nextNonce = fallback1Node.config.latestNonce;
    primaryNode.config.latestNonce = nextNonce;
    primaryNode.config.pendingNonce = nextNonce;
    primaryNode.config.timeoutSendRawTx = false;
    primaryNode.config.failSendRawTxWithError = 'socket hang up after broadcast';

    // Pre-populate Fallback #1 with the deterministic transaction that Primary "broadcasted" before dropping
    const iface = new ethers.Interface(['function transfer(address to, uint256 amount) returns (bool)']);
    const callData = iface.encodeFunctionData('transfer', [approvedDest, ethers.parseUnits('75', 18)]);
    const signedRaw = await preSeededWallet.signTransaction({
      to: OFFICIAL_BSC_USDT_CONTRACT,
      data: callData,
      value: 0n,
      nonce: nextNonce,
      gasLimit: 100000n,
      gasPrice: BigInt('0xb2d05e00'),
      chainId: 56,
      type: 0
    });
    const preBroadcastHash = ethers.keccak256(signedRaw).toLowerCase();
    fallback1Node.config.broadcastedTxs.set(preBroadcastHash, {
      rawTx: signedRaw,
      from: preSeededWallet.address,
      to: OFFICIAL_BSC_USDT_CONTRACT,
      nonce: nextNonce,
      blockNumber: fallback1Node.config.blockNumber
    });
    fallback1Node.config.latestNonce = nextNonce + 1;
    fallback1Node.config.pendingNonce = nextNonce + 1;
    const fbSendCountBeforeCaseB = fallback1Node.config.sendRawTxCallCount;

    const dedupSwitchRes = await hotWalletService.withdrawToBinance({
      amountUsd: 75.00,
      destinationAddress: approvedDest,
      networkId: 'BSC',
      idempotencyKey: 'idemp_rpc_switch_already_onchain',
      operator: 'test_operator'
    });
    assert(dedupSwitchRes.success === true && dedupSwitchRes.state === 'CONFIRMED', 'Confirms existing on-chain tx after RPC switch');
    assert(fallback1Node.config.sendRawTxCallCount === fbSendCountBeforeCaseB, 'Does NOT re-broadcast when Fallback RPC finds txHash already on-chain');
    primaryNode.config.failSendRawTxWithError = null;
    primaryNode.config.latestNonce = fallback1Node.config.latestNonce;
    primaryNode.config.pendingNonce = fallback1Node.config.pendingNonce;

    // -------------------------------------------------------------------------
    // TEST 12: Nonce Collision Detection
    // -------------------------------------------------------------------------
    console.log('\n--- 12. NONCE COLLISION DETECTION ---');
    // Simulate an unknown external pending transaction occupying the wallet's pending nonce
    primaryNode.config.pendingNonce = primaryNode.config.latestNonce + 2;
    const collisionRes = await hotWalletService.withdrawToBinance({
      amountUsd: 30.00,
      destinationAddress: approvedDest,
      networkId: 'BSC',
      idempotencyKey: 'idemp_nonce_collision_1',
      operator: 'test_operator'
    });
    assert(collisionRes.success === false && collisionRes.errorDetails === 'NONCE_COLLISION', 'Detects on-chain pending nonce collision and halts withdrawal');
    primaryNode.config.pendingNonce = primaryNode.config.latestNonce;

    // -------------------------------------------------------------------------
    // TEST 13: Failed Broadcast
    // -------------------------------------------------------------------------
    console.log('\n--- 13. FAILED BROADCAST HANDLING ---');
    primaryNode.config.failSendRawTxWithError = 'execution reverted: BEP20: transfer amount exceeds balance';
    const failedBroadcastRes = await hotWalletService.withdrawToBinance({
      amountUsd: 40.00,
      destinationAddress: approvedDest,
      networkId: 'BSC',
      idempotencyKey: 'idemp_failed_broadcast_1',
      operator: 'test_operator'
    });
    assert(failedBroadcastRes.success === false && failedBroadcastRes.state === 'FAILED' && failedBroadcastRes.errorDetails === 'BROADCAST_FAILED', 'Deterministic broadcast failure transitions to FAILED and never claims settlement');
    primaryNode.config.failSendRawTxWithError = null;

    // -------------------------------------------------------------------------
    // TEST 14: Unknown Broadcast Result (All Fallback RPCs Unreachable Mid-Broadcast)
    // -------------------------------------------------------------------------
    console.log('\n--- 14. UNKNOWN BROADCAST RESULT ---');
    primaryNode.config.failSendRawTxWithError = 'ECONNRESET: socket hang up';
    fallback1Node.config.shouldFailAll = true;
    fallback2Node.config.shouldFailAll = true;

    const unknownBroadcastRes = await hotWalletService.withdrawToBinance({
      amountUsd: 45.00,
      destinationAddress: approvedDest,
      networkId: 'BSC',
      idempotencyKey: 'idemp_unknown_broadcast_1',
      operator: 'test_operator'
    });
    assert(
      unknownBroadcastRes.success === false &&
      unknownBroadcastRes.state === 'PENDING_CONFIRMATION' &&
      unknownBroadcastRes.errorDetails === 'UNKNOWN_BROADCAST_RESULT',
      'Marks UNKNOWN_BROADCAST_RESULT (PENDING_CONFIRMATION, success=false) when active RPC drops mid-broadcast and fallbacks are unreachable'
    );
    primaryNode.config.failSendRawTxWithError = null;
    fallback1Node.config.shouldFailAll = false;
    fallback2Node.config.shouldFailAll = false;

    // -------------------------------------------------------------------------
    // TEST 15: Receipt Timeout (Broadcast Alone Never Treated as Settlement)
    // -------------------------------------------------------------------------
    console.log('\n--- 15. RECEIPT TIMEOUT (NO UNCONFIRMED SETTLEMENT) ---');
    primaryNode.config.returnNullReceipt = true;
    fallback1Node.config.returnNullReceipt = true;
    fallback2Node.config.returnNullReceipt = true;

    const receiptTimeoutRes = await hotWalletService.withdrawToBinance({
      amountUsd: 60.00,
      destinationAddress: approvedDest,
      networkId: 'BSC',
      idempotencyKey: 'idemp_receipt_timeout_1',
      operator: 'test_operator'
    });
    assert(
      receiptTimeoutRes.success === false &&
      receiptTimeoutRes.state === 'PENDING_CONFIRMATION' &&
      receiptTimeoutRes.errorDetails === 'RECEIPT_TIMEOUT',
      'When receipt times out, returns success=false and state=PENDING_CONFIRMATION (never claims settlement on broadcast alone)'
    );

    // Now allow receipt to be mined and run reconciliation (Requirement 10.16)
    primaryNode.config.returnNullReceipt = false;
    fallback1Node.config.returnNullReceipt = false;
    fallback2Node.config.returnNullReceipt = false;

    const postTimeoutRecon = await hotWalletService.reconcileWithBlockchain();
    assert(postTimeoutRecon.reconciledCount >= 1 && postTimeoutRecon.discrepancyDetected === false, 'Post-timeout blockchain reconciliation resolves pending transaction once receipt is mined');

    // -------------------------------------------------------------------------
    // TEST 16: Zero Secret Exposure Audit
    // -------------------------------------------------------------------------
    console.log('\n--- 16. ZERO SECRET & PRIVATE URL EXPOSURE AUDIT ---');
    const statusPayload = JSON.stringify(await hotWalletService.getFullStatus());
    const readinessPayload = JSON.stringify(await hotWalletService.checkTreasuryReadiness());
    assert(!statusPayload.includes(testSecret1) && !statusPayload.includes(testSecret2), 'Private keys never appear in status payload');
    assert(!readinessPayload.includes(testSecret1) && !readinessPayload.includes(testSecret2), 'Private keys never appear in readiness payload');

  } finally {
    await primaryNode.close();
    await fallback1Node.close();
    await fallback2Node.close();

    if (origKey !== undefined) process.env.TREASURY_HOT_WALLET_PRIVATE_KEY = origKey;
    else delete process.env.TREASURY_HOT_WALLET_PRIVATE_KEY;
    if (origNet !== undefined) process.env.TREASURY_HOT_WALLET_NETWORK = origNet;
    else delete process.env.TREASURY_HOT_WALLET_NETWORK;
    if (origRpc !== undefined) process.env.BSC_RPC_URL = origRpc;
    else delete process.env.BSC_RPC_URL;
    if (origFallbacks !== undefined) process.env.BSC_RPC_FALLBACK_URLS = origFallbacks;
    else delete process.env.BSC_RPC_FALLBACK_URLS;
    if (origTimeout !== undefined) process.env.BSC_RPC_TIMEOUT_MS = origTimeout;
    else delete process.env.BSC_RPC_TIMEOUT_MS;
    if (origMaxBlockAge !== undefined) process.env.BSC_RPC_MAX_BLOCK_AGE_SECONDS = origMaxBlockAge;
    else delete process.env.BSC_RPC_MAX_BLOCK_AGE_SECONDS;
    if (origReceiptTimeout !== undefined) process.env.BSC_RECEIPT_TIMEOUT_MS = origReceiptTimeout;
    else delete process.env.BSC_RECEIPT_TIMEOUT_MS;
    if (origMinGas !== undefined) process.env.TREASURY_MIN_GAS_RESERVE_BNB = origMinGas;
    else delete process.env.TREASURY_MIN_GAS_RESERVE_BNB;
    if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
    else delete process.env.NODE_ENV;
    if (origUsdtEnv !== undefined) process.env.BSC_USDT_CONTRACT_ADDRESS = origUsdtEnv;
    else delete process.env.BSC_USDT_CONTRACT_ADDRESS;

    hotWalletService.initWallet();
  }

  console.log('\n================================================================');
  console.log(`  HOT-WALLET & BSC RPC TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log('================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
  process.exit(0);
}

runHotWalletTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
