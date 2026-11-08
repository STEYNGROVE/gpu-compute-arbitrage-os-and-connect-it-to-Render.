/** Owner-only diagnostic route. Read-only; does not authorize procurement. */
import type { Express, RequestHandler } from 'express';
import { probeSupplierBalance } from './supplierBalanceReadOnly.js';

export function registerSupplierBalanceDiagnostics(app: Express, requireOwnerAuth: RequestHandler): void {
  app.get('/api/owner/supplier-balances', requireOwnerAuth, async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const suppliers = await Promise.all([
      probeSupplierBalance('vast_ai'),
      probeSupplierBalance('runpod'),
    ]);
    res.status(200).json({
      mode: 'READ_ONLY',
      procurementBlocked: true,
      payoutsBlocked: true,
      tradingBlocked: true,
      checkedAt: new Date().toISOString(),
      suppliers,
    });
  });
}
