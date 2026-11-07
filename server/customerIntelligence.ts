import type { Express, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import crypto from 'node:crypto';

type Auth = (req: Request, res: Response, next: NextFunction) => void;
const url = process.env.DATABASE_URL;
const host = url ? new URL(url).hostname : '';
const pool = url ? new Pool({ connectionString: url, ssl: host === 'localhost' || /^dpg-[a-z0-9-]+-a$/.test(host) ? undefined : { rejectUnauthorized: true }, max: 2 }) : null;
let initialized: Promise<unknown> | undefined;
async function ready() {
  if (!pool) throw Error('DATABASE_URL_NOT_CONFIGURED');
  if (!initialized) initialized = pool.query(`CREATE TABLE IF NOT EXISTS customer_intelligence_leads (
    id uuid PRIMARY KEY, company text NOT NULL, source_url text NOT NULL,
    evidence text NOT NULL, workload text NOT NULL, contact_channel text NOT NULL,
    estimated_gpu_count integer, verified_customer boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'DISCOVERED', created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(source_url,company),
    CONSTRAINT valid_lead_status CHECK (status IN ('DISCOVERED','REVIEWING','QUALIFIED','DISQUALIFIED'))
  )`).catch(e => { initialized = undefined; throw e; });
  await initialized;
}
const str = (v: unknown, n: number) => typeof v === 'string' ? v.trim().slice(0,n) : '';
const validUrl = (s: string) => { try { const u = new URL(s); return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname && !['localhost','127.0.0.1'].includes(u.hostname) && !u.hostname.endsWith('.local'); } catch { return false; } };
export function registerCustomerIntelligence(app: Express, owner: Auth) {
  app.get('/api/owner/customer-intelligence', owner, async (_req,res) => {
    try { await ready(); const result = await pool!.query('SELECT id,company,source_url,evidence,workload,contact_channel,estimated_gpu_count,verified_customer,status,created_at FROM customer_intelligence_leads ORDER BY created_at DESC LIMIT 200'); res.setHeader('Cache-Control','no-store'); res.json({ mode:'SIMULATION_ONLY', automatedOutreachEnabled:false, procurementEnabled:false, leads:result.rows }); }
    catch { res.status(503).json({ error:'LEAD_STORAGE_UNAVAILABLE' }); }
  });
  app.post('/api/owner/customer-intelligence', owner, async (req,res) => {
    const b=req.body || {}; const company=str(b.company,120), source=str(b.sourceUrl,800), evidence=str(b.evidence,2000), workload=str(b.workload,400), channel=str(b.contactChannel,250);
    const count=b.estimatedGpuCount == null ? null : Number(b.estimatedGpuCount);
    if (!company || !validUrl(source) || !evidence || !workload || !channel || (count!==null && (!Number.isInteger(count)||count<1||count>100000))) return res.status(400).json({error:'INVALID_LEAD'});
    try { await ready(); const result=await pool!.query(`INSERT INTO customer_intelligence_leads (id,company,source_url,evidence,workload,contact_channel,estimated_gpu_count) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(source_url,company) DO NOTHING RETURNING id`,[crypto.randomUUID(),company,source,evidence,workload,channel,count]);
      if (!result.rowCount) return res.status(409).json({error:'DUPLICATE_LEAD'});
      return res.status(201).json({id:result.rows[0].id,status:'DISCOVERED',verifiedCustomer:false,automatedOutreachEnabled:false});
    } catch { return res.status(503).json({error:'LEAD_STORAGE_UNAVAILABLE'}); }
  });
  app.patch('/api/owner/customer-intelligence/:id', owner, async(req,res)=>{
    const id=req.params.id, status=str(req.body?.status,20);
    if (!/^[a-f0-9-]{36}$/i.test(id)||!['DISCOVERED','REVIEWING','QUALIFIED','DISQUALIFIED'].includes(status)) return res.status(400).json({error:'INVALID_UPDATE'});
    try { await ready(); const result=await pool!.query('UPDATE customer_intelligence_leads SET status=$1 WHERE id=$2 RETURNING id,status',[status,id]); if(!result.rowCount)return res.status(404).json({error:'NOT_FOUND'}); return res.json({...result.rows[0],verifiedCustomer:false}); }
    catch { return res.status(503).json({error:'LEAD_STORAGE_UNAVAILABLE'}); }
  });
}
