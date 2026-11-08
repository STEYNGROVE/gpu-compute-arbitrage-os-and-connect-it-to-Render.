import crypto from 'node:crypto';

export type BinancePaymentEvidence = {
  verified: boolean;
  state: 'VERIFIED' | 'UNVERIFIED' | 'NOT_CONFIGURED';
  merchantTradeNo: string;
  prepayId?: string;
  transactionId?: string;
  amount?: string;
  currency?: string;
  reason: string;
};

export async function verifyBinancePayOrder(merchantTradeNo: string, expectedAmount: string): Promise<BinancePaymentEvidence> {
  const fail = (reason: string, state: BinancePaymentEvidence['state'] = 'UNVERIFIED'): BinancePaymentEvidence =>
    ({ verified: false, state, merchantTradeNo, reason });
  const validAmount = (v: string) => /^(0|[1-9][0-9]*)(\\.[0-9]{1,8})?$/.test(v) && Number(v) > 0;
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(merchantTradeNo)) return fail('INVALID_ORDER_ID');
  if (!validAmount(expectedAmount)) return fail('INVALID_EXPECTED_AMOUNT');
  const cert = process.env.BINANCE_PAY_CERT_SN;
  const secret = process.env.BINANCE_PAY_SECRET_KEY;
  if (!cert || !secret) return fail('BINANCE_PAY_MERCHANT_CREDENTIALS_MISSING', 'NOT_CONFIGURED');
  const body = JSON.stringify({ merchantTradeNo });
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha512', secret)
    .update([timestamp, nonce, body, ''].join('\\n')).digest('hex').toUpperCase();
  try {
    const response = await fetch('https://bpay.binanceapi.com/binancepay/openapi/v2/order/query', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'BinancePay-Timestamp': timestamp,
        'BinancePay-Nonce': nonce,
        'BinancePay-Certificate-SN': cert,
        'BinancePay-Signature': signature
      },
      body,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return fail('BINANCE_HTTP_' + response.status);
    const result: any = await response.json();
    if (result?.status !== 'SUCCESS' || result?.code !== '000000') return fail('BINANCE_QUERY_REJECTED');
    const order = result?.data;
    if (!order || order.merchantTradeNo !== merchantTradeNo) return fail('ORDER_ID_MISMATCH');
    if (order.status !== 'PAID') return fail('ORDER_NOT_PAID');
    if (String(order.currency) !== 'USDT') return fail('CURRENCY_MISMATCH');
    const units = (v: string) => {
      if (!/^(0|[1-9][0-9]*)(\\.[0-9]{1,8})?$/.test(v)) return null;
      const [whole, frac = ''] = v.split('.');
      return BigInt(whole) * 100000000n + BigInt(frac.padEnd(8, '0'));
    };
    const amount = String(order.totalFee ?? '');
    if (units(amount) === null || units(amount) !== units(expectedAmount)) return fail('AMOUNT_MISMATCH');
    if (!order.prepayId && !order.transactionId) return fail('EXTERNAL_TRANSACTION_REFERENCE_MISSING');
    return {
      verified: true, state: 'VERIFIED', merchantTradeNo,
      prepayId: String(order.prepayId ?? ''),
      transactionId: String(order.transactionId ?? ''),
      amount, currency: 'USDT',
      reason: 'BINANCE_PAY_ORDER_QUERY_CONFIRMED'
    };
  } catch {
    return fail('BINANCE_QUERY_UNAVAILABLE');
  }
}
