import type { Express, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';

type Auth = (req: Request, res: Response, next: NextFunction) => void;
const url = process.env.DATABASE_URL;
const host = url ? new URL(url).hostname : '';
const internal = host === 'localhost' || /^dpg-[a-z0-9-]+-a$/.test(host);
const pool = url ? new Pool({ connectionString: url, ssl: internal ? undefined : { rejectUnauthorized: true }, max: 2 }) : null;

// Read-only owner operations snapshot. Counts are not sales, signed contracts, or revenue.
export function registerOwnerOperations(app: Express, requireOwnerAuth: Auth) {
  app.get('/api/owner/operations-summary', requireOwnerAuth, async (_req, res) => {
    if (!pool) return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    try {
      const quotes = await pool.query(`SELECT status, count(*)::int AS total FROM commercial_quote_requests GROUP BY status`);
      const approvalsTable = await pool.query(`SELECT to_regclass('public.preapproved_workload_evidence') IS NOT NULL AS exists`);
      const approvals = approvalsTable.rows[0].exists
        ? (await pool.query(`SELECT state, count(*)::int AS total FROM preapproved_workload_evidence GROUP BY state`)).rows
        : [];
      const count = (rows: any[], key: string) => Object.fromEntries(rows.map(r => [String(r[key]), Number(r.total)]));
      return res.json({
        generatedAt: new Date().toISOString(),
        environment: 'SIMULATION_ONLY',
        executionEnabled: false,
        quoteRequests: count(quotes.rows, 'status'),
        approvals: count(approvals, 'state'),
        approvalStorageInitialized: approvalsTable.rows[0].exists,
        verifiedRevenueUsd: null,
        revenueVerificationStatus: 'NOT_VERIFIED',
        warning: 'Status counts are administrative metadata, not proof of contracts, payments, or real revenue.'
      });
    } catch (_err) {
      return res.status(503).json({ error: 'OPERATIONS_SUMMARY_UNAVAILABLE' });
    }
  });
}
