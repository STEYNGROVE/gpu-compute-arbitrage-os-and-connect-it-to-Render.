import type { Express, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import crypto from 'node:crypto';

type Auth = (req: Request, res: Response, next: NextFunction) => void;
type EvidenceType = 'SIGNED_CONTRACT' | 'APPROVED_PURCHASE_ORDER' | 'VERIFIED_PREPAYMENT';
type State = 'PENDING_VERIFICATION' | 'APPROVAL_VERIFIED' | 'REJECTED';
const types: EvidenceType[] = ['SIGNED_CONTRACT', 'APPROVED_PURCHASE_ORDER', 'VERIFIED_PREPAYMENT'];
const dbUrl = process.env.DATABASE_URL;
const host = dbUrl ? new URL(dbUrl).hostname : '';
const internal = host === 'localhost' || /^dpg-[a-z0-9-]+-a$/.test(host);
const pool = dbUrl ? new Pool({connectionString: dbUrl, ssl: internal ? undefined : {rejectUnauthorized: true}, max: 2}) : null;
const limit = (s: unknown, n: number) => typeof s === 'string' ? s.trim().slice(0,n) : '';
let readyPromise: Promise<unknown> | undefined;
async function ready() {
  if (!pool) throw Error('DATABASE_URL_NOT_CONFIGURED');
  if (!readyPromise) readyPromise = pool.query(`CREATE TABLE IF NOT EXISTS preapproved_workload_evidence (
    id uuid PRIMARY KEY, customer_name text NOT NULL, customer_email text NOT NULL,
    workload_description text NOT NULL, evidence_type text NOT NULL,
    evidence_sha256 text NOT NULL, document_reference text NOT NULL,
    issuer_name text NOT NULL, issuer_contact text NOT NULL,
    budget_currency text NOT NULL, approved_budget numeric(18,2) NOT NULL,
    valid_until date, state text NOT NULL DEFAULT 'PENDING_VERIFICATION',
    reviewer text, verification_notes text, verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT valid_evidence_type CHECK (evidence_type IN ('SIGNED_CONTRACT','APPROVED_PURCHASE_ORDER','VERIFIED_PREPAYMENT')),
    CONSTRAINT valid_approval_state CHECK (state IN ('PENDING_VERIFICATION','APPROVAL_VERIFIED','REJECTED')),
    CONSTRAINT positive_budget CHECK (approved_budget > 0)
  )`).catch(e=>{readyPromise=undefined; throw e;});
  await readyPromise;
}
// Owner-only workflow. This records documentary evidence metadata; it never accepts a bare
// lead status as proof and never executes jobs, purchases, payments or withdrawals.
export function registerPreapprovedWorkloads(app: Express, requireOwnerAuth: Auth) {
  app.post('/api/approvals/evidence', requireOwnerAuth, async (req,res) => {
    const b = req.body || {};
    const type = limit(b.evidenceType,40) as EvidenceType;
    const sha = limit(b.evidenceSha256,64).toLowerCase();
    const budget = Number(b.approvedBudget);
    const fields = {
      customerName: limit(b.customerName,120), customerEmail: limit(b.customerEmail,254),
      workloadDescription: limit(b.workloadDescription,1000),
      documentReference: limit(b.documentReference,160), issuerName: limit(b.issuerName,160),
      issuerContact: limit(b.issuerContact,254), budgetCurrency: limit(b.budgetCurrency,3).toUpperCase(),
      validUntil: limit(b.validUntil,10)
    };
    if (!types.includes(type) || !/^[a-f0-9]{64}$/.test(sha) ||
        !fields.customerName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.customerEmail) ||
        !fields.workloadDescription || !fields.documentReference || !fields.issuerName ||
        !fields.issuerContact || !/^[A-Z]{3}$/.test(fields.budgetCurrency) ||
        !Number.isFinite(budget) || budget <= 0 || budget > 1e12 ||
        (fields.validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(fields.validUntil))) {
      return res.status(400).json({error:'INVALID_EVIDENCE_METADATA'});
    }
    try {
      await ready();
      const id = crypto.randomUUID();
      await pool!.query(`INSERT INTO preapproved_workload_evidence
      (id,customer_name,customer_email,workload_description,evidence_type,evidence_sha256,
       document_reference,issuer_name,issuer_contact,budget_currency,approved_budget,valid_until)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id,fields.customerName,fields.customerEmail,fields.workloadDescription,type,sha,
       fields.documentReference,fields.issuerName,fields.issuerContact,fields.budgetCurrency,budget,
       fields.validUntil || null]);
      return res.status(201).json({id,state:'PENDING_VERIFICATION',executionEnabled:false});
    } catch { return res.status(503).json({error:'EVIDENCE_STORAGE_UNAVAILABLE'}); }
  });
  app.get('/api/approvals/workloads', requireOwnerAuth, async (_req,res) => {
    try {
      await ready();
      const result = await pool!.query(`SELECT id,customer_name,customer_email,workload_description,
        evidence_type,evidence_sha256,document_reference,issuer_name,issuer_contact,
        budget_currency,approved_budget,valid_until,state,reviewer,verification_notes,verified_at,created_at
        FROM preapproved_workload_evidence ORDER BY created_at DESC LIMIT 100`);
      return res.json({workloads:result.rows,executionEnabled:false});
    } catch { return res.status(503).json({error:'EVIDENCE_STORAGE_UNAVAILABLE'}); }
  });
  app.post('/api/approvals/workloads/:id/decision', requireOwnerAuth, async (req,res) => {
    const id = req.params.id;
    const state = limit(req.body?.state,30) as State;
    const reviewer = limit(req.body?.reviewer,120);
    const notes = limit(req.body?.verificationNotes,2000);
    const independentlyConfirmed = req.body?.independentlyConfirmed === true;
    const checkedDocumentHash = limit(req.body?.checkedDocumentHash,64).toLowerCase();
    if (!/^[0-9a-f-]{36}$/i.test(id) || !['APPROVAL_VERIFIED','REJECTED'].includes(state) ||
        !reviewer || !notes || (state === 'APPROVAL_VERIFIED' &&
        (!independentlyConfirmed || !/^[a-f0-9]{64}$/.test(checkedDocumentHash)))) {
      return res.status(400).json({error:'VERIFICATION_REQUIREMENTS_NOT_MET'});
    }
    try {
      await ready();
      const result = await pool!.query(`UPDATE preapproved_workload_evidence
        SET state=$2,reviewer=$3,verification_notes=$4,verified_at=now()
        WHERE id=$1 AND state='PENDING_VERIFICATION'
          AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
          AND ($2='REJECTED' OR evidence_sha256=$5)
        RETURNING id,state,verified_at`,[id,state,reviewer,notes,checkedDocumentHash]);
      if (!result.rowCount) return res.status(409).json({error:'NOT_PENDING_EXPIRED_OR_HASH_MISMATCH'});
      return res.json({...result.rows[0],executionEnabled:false});
    } catch { return res.status(503).json({error:'EVIDENCE_STORAGE_UNAVAILABLE'}); }
  });
}
