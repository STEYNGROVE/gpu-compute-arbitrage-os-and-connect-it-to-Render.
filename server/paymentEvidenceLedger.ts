import { createHash } from 'node:crypto';

type Db = {
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null }>;
};

type Expected = {
  orderId: string;
  customerId: string;
  provider: string;
  currency: string;
  amountMinor: number;
  expiresAt: string;
};

type Observed = {
  orderId: string;
  customerId: string;
  provider: string;
  currency: string;
  amountMinor: number;
  transactionId: string;
  status: string;
  observedAt: string;
  authenticatedByProvider: boolean;
  independentlyFetched: boolean;
};

function reject(reason: string) {
  return {
    recorded: false,
    verifiedPayment: false,
    procurementBlocked: true,
    reason
  };
}

export async function recordUnverifiedPaymentObservation(
  db: Db,
  expected: Expected,
  observed: Observed
) {
  const identity = [
    expected.orderId,
    expected.customerId,
    expected.provider,
    expected.currency
  ];

  if (identity.some(v => typeof v !== 'string' || !v.trim()) ||
      !/^[A-Z0-9_]{2,32}$/.test(expected.provider) ||
      !/^[A-Z]{3,8}$/.test(expected.currency) ||
      typeof observed.transactionId !== 'string' ||
      observed.transactionId.trim().length < 8 ||
      observed.transactionId.trim().length > 256) {
    return reject('INVALID_IDENTITY');
  }

  if (expected.orderId !== observed.orderId ||
      expected.customerId !== observed.customerId ||
      expected.provider !== observed.provider ||
      expected.currency !== observed.currency) {
    return reject('IDENTITY_MISMATCH');
  }

  if (!Number.isSafeInteger(expected.amountMinor) ||
      !Number.isSafeInteger(observed.amountMinor) ||
      expected.amountMinor <= 0 ||
      expected.amountMinor !== observed.amountMinor) {
    return reject('AMOUNT_MISMATCH');
  }

  const observedTime = Date.parse(observed.observedAt);
  const expiry = Date.parse(expected.expiresAt);

  if (!Number.isFinite(observedTime) ||
      !Number.isFinite(expiry)) {
    return reject('INVALID_OBSERVATION_TIME');
  }

  if (observedTime > expiry) {
    return reject('EVIDENCE_EXPIRED');
  }

  // These observations are not independently authenticated here.
  // Never convert them into settlement or spending authority.
  const digest = createHash('sha256')
    .update(JSON.stringify({
      provider: expected.provider,
      transactionId: observed.transactionId,
      customerId: expected.customerId,
      orderId: expected.orderId,
      amountMinor: expected.amountMinor,
      currency: expected.currency
    }))
    .digest('hex');

  try {
    const result = await db.query(
      `INSERT INTO gpu_payment_evidence_allocations
       (provider, provider_transaction_id, customer_id,
        order_id, amount_minor, currency, evidence_sha256)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        expected.provider,
        observed.transactionId,
        expected.customerId,
        expected.orderId,
        expected.amountMinor,
        expected.currency,
        digest
      ]
    );

    if (result.rowCount !== 1) {
      return reject('DUPLICATE_TRANSACTION');
    }

    return {
      recorded: true,
      verifiedPayment: false,
      procurementBlocked: true,
      reason: 'UNVERIFIED_OBSERVATION_ONLY'
    };
  } catch {
    return reject('EVIDENCE_STORAGE_UNAVAILABLE');
  }
}
