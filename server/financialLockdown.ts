import type { RequestHandler } from 'express';

// Match Express's case-insensitive routes. No environment flag can lift this lock.
const financialPath = /^(\/compute\/(execute-deal|settle-deal|abort-job)(?:\/|$)|\/provisioning(?:\/|$)|\/treasury(?:\/|$)|\/capital(?:\/|$)|\/payments(?:\/|$)|\/webhooks\/(escrow|binance|treasury)(?:\/|$)|\/kill-switch\/disengage(?:\/|$)|\/autonomous\/deploy(?:\/|$)|\/zero-funded\/spending-gate(?:\/|$))/i;

export const financialLockdown: RequestHandler = (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && financialPath.test(req.path)) {
    res.status(423).json({ error: 'FINANCIAL_EXECUTION_DISABLED_PHASE_2_3' });
    return;
  }
  next();
};
