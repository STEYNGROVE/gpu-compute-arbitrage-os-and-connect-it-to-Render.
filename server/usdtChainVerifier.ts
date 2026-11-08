import { ethers } from 'ethers';

const MAINNET_CHAIN_ID = 1n;
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const CONFIRMATIONS = 12;

export type ChainVerification = {
  verified: boolean;
  status: string;
  chainId: number;
  txHash: string;
  amount?: string;
  logIndex?: number;
  blockNumber?: number;
  confirmations?: number;
};

/** Read-only chain verification. No key material, transfers, credits, or spending. */
export async function verifyEthereumUsdtTransfer(input: {
  txHash: string;
  destination: string;
  expectedAmount: string;
}): Promise<ChainVerification> {
  const fail = (status: string): ChainVerification => ({ verified: false, status, chainId: 1, txHash: input.txHash });
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.txHash)) return fail('INVALID_TRANSACTION_HASH');
  if (!ethers.isAddress(input.destination)) return fail('INVALID_DESTINATION');
  if (!/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(input.expectedAmount) || ethers.parseUnits(input.expectedAmount, 6) <= 0n)
    return fail('INVALID_AMOUNT');
  const rpc = process.env.ETHEREUM_MAINNET_RPC_URL;
  const configuredWallet = process.env.USDT_ERC20_RECEIVING_ADDRESS;
  if (!rpc || !configuredWallet || !ethers.isAddress(configuredWallet)) return fail('NOT_CONFIGURED');
  if (ethers.getAddress(input.destination) !== ethers.getAddress(configuredWallet)) return fail('DESTINATION_NOT_AUTHORIZED');
  let provider: ethers.JsonRpcProvider | undefined;
  try {
    provider = new ethers.JsonRpcProvider(rpc);
    const [network, receipt, height] = await Promise.all([
      provider.getNetwork(), provider.getTransactionReceipt(input.txHash), provider.getBlockNumber()
    ]);
    if (network.chainId !== MAINNET_CHAIN_ID) return fail('WRONG_CHAIN');
    if (!receipt) return fail('TRANSACTION_NOT_MINED');
    if (receipt.status !== 1) return fail('TRANSACTION_REVERTED');
    const confirmations = height - receipt.blockNumber + 1;
    if (confirmations < CONFIRMATIONS) return fail('INSUFFICIENT_CONFIRMATIONS');
    const expected = ethers.parseUnits(input.expectedAmount, 6);
    const target = ethers.getAddress(configuredWallet).toLowerCase();
    const matches = receipt.logs.filter(log => {
      if (log.address.toLowerCase() !== USDT.toLowerCase() || log.topics.length !== 3 || log.topics[0] !== TRANSFER_TOPIC) return false;
      const to = ethers.getAddress('0x' + log.topics[2].slice(26)).toLowerCase();
      if (to !== target) return false;
      try { return BigInt(log.data) === expected; } catch { return false; }
    });
    if (matches.length !== 1) return fail(matches.length ? 'AMBIGUOUS_MATCHING_TRANSFERS' : 'USDT_TRANSFER_NOT_MATCHED');
    return {
      verified: true, status: 'ON_CHAIN_TRANSFER_CONFIRMED', chainId: 1,
      txHash: receipt.hash, amount: input.expectedAmount, logIndex: matches[0].index,
      blockNumber: receipt.blockNumber, confirmations
    };
  } catch {
    return fail('CHAIN_QUERY_FAILED');
  } finally {
    provider?.destroy();
  }
}
