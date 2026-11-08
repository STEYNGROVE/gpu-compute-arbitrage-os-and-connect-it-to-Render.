import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { ethers } from 'ethers';
import { verifyEthereumUsdtTransfer } from './usdtChainVerifier.js';

const wallet = () => {
  const value = process.env.USDT_ERC20_RECEIVING_ADDRESS;
  if (!value || !ethers.isAddress(value)) throw new Error('USDT_WALLET_NOT_CONFIGURED');
  return ethers.getAddress(value);
};
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 5000, ssl: process.env.USDT_DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined });
let initialized: Promise<void> | undefined;
function init() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_NOT_CONFIGURED');
  return initialized ??= (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS usdt_customer_invoices (
      id UUID PRIMARY KEY, customer_ref TEXT NOT NULL, amount_units BIGINT NOT NULL CHECK (amount_units > 0),
      destination TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL,
      paid_at TIMESTAMPTZ, chain_id INTEGER, tx_hash TEXT, log_index INTEGER,
      CHECK ((status='PENDING' AND paid_at IS NULL) OR (status='PAID' AND paid_at IS NOT NULL))
    )`);
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS usdt_payment_unique_event ON usdt_customer_invoices(chain_id, tx_hash, log_index) WHERE tx_hash IS NOT NULL');
  })().catch(err => { initialized = undefined; throw err; });
}
export async function createUsdtInvoice(customerRef: string, amount: string, expiresMinutes: number) {
  if (typeof customerRef !== 'string' || !/^[a-zA-Z0-9_:-]{1,100}$/.test(customerRef)) throw new Error('INVALID_CUSTOMER_REF');
  if (typeof amount !== 'string' || !/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(amount)) throw new Error('INVALID_AMOUNT');
  const units = ethers.parseUnits(amount, 6);
  if (units <= 0n || units > 100000000000000000n) throw new Error('INVALID_AMOUNT');
  if (!Number.isInteger(expiresMinutes) || expiresMinutes < 15 || expiresMinutes > 10080) throw new Error('INVALID_EXPIRY');
  const destination = wallet();
  await init();
  const id = randomUUID();
  const result = await pool.query(`INSERT INTO usdt_customer_invoices (id,customer_ref,amount_units,destination,expires_at)
    VALUES ($1,$2,$3,$4,NOW()+($5::int * INTERVAL '1 minute')) RETURNING *`, [id, customerRef, units.toString(), destination, expiresMinutes]);
  return serialize(result.rows[0]);
}
function serialize(row: any) {
  return { id: row.id, customerRef: row.customer_ref, amountUsdt: ethers.formatUnits(BigInt(row.amount_units),6),
    destination: row.destination, status: row.status, createdAt: row.created_at, expiresAt: row.expires_at,
    paidAt: row.paid_at, txHash: row.tx_hash, logIndex: row.log_index, chainId: row.chain_id };
}
export async function getUsdtInvoice(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('INVALID_INVOICE_ID');
  await init();
  const result = await pool.query('SELECT * FROM usdt_customer_invoices WHERE id=$1', [id]);
  return result.rows[0] ? serialize(result.rows[0]) : null;
}
export async function reconcileUsdtInvoice(id: string, txHash: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error('INVALID_REQUEST');
  await init();
  const invoice = await pool.query('SELECT * FROM usdt_customer_invoices WHERE id=$1', [id]);
  const row = invoice.rows[0];
  if (!row) return { verified:false, status:'INVOICE_NOT_FOUND' };
  if (row.status !== 'PENDING') return { verified:false, status:'INVOICE_NOT_PENDING' };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { verified:false, status:'INVOICE_EXPIRED' };
  if (ethers.getAddress(row.destination) !== wallet()) return { verified:false, status:'WALLET_CONFIGURATION_CHANGED' };
  const evidence = await verifyEthereumUsdtTransfer({txHash, destination:row.destination, expectedAmount:ethers.formatUnits(BigInt(row.amount_units),6)});
  if (!evidence.verified || evidence.logIndex === undefined) return { ...evidence, allocated:false };
  // Reject historical or late transfers: invoice must exist when payment is mined.
  const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_MAINNET_RPC_URL);
  try {
    const block = await provider.getBlock(evidence.blockNumber!);
    if (!block) return { verified:false, status:'TRANSFER_BLOCK_UNAVAILABLE', allocated:false };
    const minedAt = block.timestamp * 1000;
    if (minedAt < new Date(row.created_at).getTime() || minedAt > new Date(row.expires_at).getTime())
      return { verified:false, status:'TRANSFER_OUTSIDE_INVOICE_WINDOW', allocated:false };
  } finally { provider.destroy(); }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const claim = await client.query(`UPDATE usdt_customer_invoices SET status='PAID', paid_at=NOW(), chain_id=$3,
      tx_hash=$4, log_index=$5 WHERE id=$1 AND status='PENDING' AND expires_at>NOW() AND destination=$2 RETURNING *`,
      [id,row.destination,1,evidence.txHash.toLowerCase(),evidence.logIndex]);
    if (!claim.rowCount) { await client.query('ROLLBACK'); return { verified:false, status:'INVOICE_NO_LONGER_PAYABLE', allocated:false }; }
    await client.query('COMMIT');
    return { verified:true, status:'INVOICE_PAID_ON_CHAIN', allocated:true, invoice:serialize(claim.rows[0]),
      evidence, purchasingUnlocked:false, treasuryCredited:false };
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error?.code === '23505') return { verified:false, status:'TRANSFER_ALREADY_ALLOCATED', allocated:false };
    throw error;
  } finally { client.release(); }
}
