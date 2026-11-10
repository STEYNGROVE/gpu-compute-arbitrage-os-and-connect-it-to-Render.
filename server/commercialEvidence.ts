import type { Express, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs';

type Auth = (req: Request, res: Response, next: NextFunction) => void;
const url = process.env.DATABASE_URL;
const host = url ? new URL(url).hostname : '';
const internal = host === 'localhost' || /^dpg-[a-z0-9-]+-a$/.test(host);
const pool = url ? new Pool({ connectionString: url, ssl: internal ? undefined : {
 rejectUnauthorized: true,
 ...(process.env.DATABASE_SSL_CA ? { ca: fs.readFileSync(process.env.DATABASE_SSL_CA,'utf8') } : {})
}, max: 2 }) : null;
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const states = ['UNVERIFIED','CONTACTED','IDENTITY_REVIEWED','REJECTED'];
const quoteStates = ['DRAFT','ISSUED_RECORDED','ACCEPTANCE_RECORDED','VOID'];
const text = (v: unknown, n: number) => typeof v === 'string' && v.trim().length <= n ? v.trim() : null;
const rate = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1000000 && Math.round(v*1e6) === v*1e6;
const fail = (res: Response) => res.status(503).json({ error: 'COMMERCIAL_EVIDENCE_DATABASE_UNAVAILABLE_OR_NOT_MIGRATED' });
export function validateVerification(b: any): boolean {
 return !!b && states.includes(b.state) && text(b.evidenceReference,500) !== null && text(b.reviewNote,2000) !== null &&
 (b.state !== 'IDENTITY_REVIEWED' || (text(b.evidenceReference,500) || '').length > 0);
}
export function validateQuote(b: any): boolean {
 return !!b && rate(b.customerRateUsdPerGpuHour) && rate(b.providerRateUsdPerGpuHour) &&
 rate(b.additionalCostUsd) && b.additionalCostUsd <= 100000000 &&
 typeof b.validUntil === 'string' && /^\d{4}-\d\d-\d\dT/.test(b.validUntil) &&
 Number.isFinite(Date.parse(b.validUntil)) && Date.parse(b.validUntil)>Date.now() &&
 Date.parse(b.validUntil)<Date.now()+366*86400000;
}
export function registerCommercialEvidence(app: Express, auth: Auth) {
 app.get('/api/owner/commercial-evidence/:id',auth,async(req,res)=>{
  if(!uuid(req.params.id)) return res.status(400).json({error:'INVALID_ID'});
  if(!pool) return fail(res);
  try {
   const record=await pool.query('SELECT id,company,contact_name,email,workload,gpu_model,gpu_count,hours,status FROM commercial_quote_requests WHERE id=$1',[req.params.id]);
   if(!record.rowCount) return res.status(404).json({error:'NOT_FOUND'});
   const verification=await pool.query('SELECT state,evidence_reference,review_note,reviewed_at FROM commercial_verification WHERE request_id=$1',[req.params.id]);
   const quotes=await pool.query('SELECT id,version,customer_rate_usd_per_gpu_hour,provider_rate_usd_per_gpu_hour,additional_cost_usd,valid_until,state,external_evidence_reference,created_at FROM commercial_quote_evidence WHERE request_id=$1 ORDER BY version DESC LIMIT 50',[req.params.id]);
   const audit=await pool.query('SELECT action,recorded_at FROM commercial_evidence_audit WHERE request_id=$1 ORDER BY id DESC LIMIT 50',[req.params.id]);
   res.setHeader('Cache-Control','no-store');return res.json({request:record.rows[0],verification:verification.rows[0]||{state:'UNVERIFIED'},quotes:quotes.rows,audit:audit.rows,verifiedPayment:false,realizedRevenueUsd:null,executionEnabled:false});
  } catch {return fail(res);}
 });
 app.post('/api/owner/commercial-evidence/:id/verification',auth,async(req,res)=>{
  if(!uuid(req.params.id)||!validateVerification(req.body)) return res.status(400).json({error:'INVALID_VERIFICATION'});
  if(!pool) return fail(res);
  const client=await pool.connect().catch(()=>null);if(!client)return fail(res);
  try {
   await client.query('BEGIN');
   const exists=await client.query('SELECT id FROM commercial_quote_requests WHERE id=$1 FOR UPDATE',[req.params.id]);
   if(!exists.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:'NOT_FOUND'});}
   const previous=await client.query('SELECT state,evidence_reference,review_note FROM commercial_verification WHERE request_id=$1',[req.params.id]);
   const b=req.body;
   const result=await client.query(`INSERT INTO commercial_verification(request_id,state,evidence_reference,review_note)
    VALUES($1,$2,$3,$4) ON CONFLICT(request_id) DO UPDATE SET state=EXCLUDED.state,evidence_reference=EXCLUDED.evidence_reference,review_note=EXCLUDED.review_note,reviewed_at=now()
    RETURNING state,evidence_reference,review_note,reviewed_at`,[req.params.id,b.state,b.evidenceReference,b.reviewNote]);
   await client.query('INSERT INTO commercial_evidence_audit(request_id,action,before_data,after_data) VALUES($1,$2,$3,$4)',[req.params.id,'VERIFICATION_REVIEW',previous.rows[0]||null,result.rows[0]]);
   await client.query('COMMIT');return res.status(200).json({verification:result.rows[0],paymentVerified:false,executionEnabled:false});
  } catch {await client.query('ROLLBACK').catch(()=>{});return fail(res);} finally{client.release();}
 });
 app.post('/api/owner/commercial-evidence/:id/quotes',auth,async(req,res)=>{
  if(!uuid(req.params.id)||!validateQuote(req.body)) return res.status(400).json({error:'INVALID_QUOTE'});
  if(!pool) return fail(res);
  const client=await pool.connect().catch(()=>null);if(!client)return fail(res);
  try {
   await client.query('BEGIN');
   const r=await client.query('SELECT id,gpu_count,hours FROM commercial_quote_requests WHERE id=$1 FOR UPDATE',[req.params.id]);
   if(!r.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:'NOT_FOUND'});}
   const next=await client.query('SELECT COALESCE(MAX(version),0)+1 AS version FROM commercial_quote_evidence WHERE request_id=$1',[req.params.id]);
   const b=req.body;
   const result=await client.query(`INSERT INTO commercial_quote_evidence(id,request_id,version,customer_rate_usd_per_gpu_hour,provider_rate_usd_per_gpu_hour,additional_cost_usd,valid_until)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,version,state,valid_until`,[crypto.randomUUID(),req.params.id,next.rows[0].version,b.customerRateUsdPerGpuHour,b.providerRateUsdPerGpuHour,b.additionalCostUsd,b.validUntil]);
   await client.query('INSERT INTO commercial_evidence_audit(request_id,action,after_data) VALUES($1,$2,$3)',[req.params.id,'QUOTE_DRAFT_CREATED',result.rows[0]]);
   await client.query('COMMIT');return res.status(201).json({quote:result.rows[0],sent:false,accepted:false,paymentVerified:false,executionEnabled:false});
  } catch {await client.query('ROLLBACK').catch(()=>{});return fail(res);} finally{client.release();}
 });
 app.post('/api/owner/commercial-evidence/:id/quotes/:quoteId/state',auth,async(req,res)=>{
  if(!uuid(req.params.id)||!uuid(req.params.quoteId)||!quoteStates.includes(req.body?.state)||text(req.body?.evidenceReference,500)===null)
   return res.status(400).json({error:'INVALID_QUOTE_STATE'});
  if(req.body.state==='DRAFT'||(req.body.state!=='VOID' && !text(req.body.evidenceReference,500)))return res.status(400).json({error:'EVIDENCE_REQUIRED'});
  if(!pool)return fail(res);
  const client=await pool.connect().catch(()=>null);if(!client)return fail(res);
  try {
   await client.query('BEGIN');
   const previous=await client.query('SELECT id,state,valid_until FROM commercial_quote_evidence WHERE id=$1 AND request_id=$2 FOR UPDATE',[req.params.quoteId,req.params.id]);
   if(!previous.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:'NOT_FOUND'});}
   const old=previous.rows[0];const next=req.body.state;
   const allowed=(old.state==='DRAFT' && ['ISSUED_RECORDED','VOID'].includes(next)) ||
    (old.state==='ISSUED_RECORDED' && ['ACCEPTANCE_RECORDED','VOID'].includes(next));
   if(!allowed || (next!=='VOID' && new Date(old.valid_until).getTime()<=Date.now())){await client.query('ROLLBACK');return res.status(409).json({error:'INVALID_OR_EXPIRED_TRANSITION'});}
   const updated=await client.query('UPDATE commercial_quote_evidence SET state=$1,external_evidence_reference=$2 WHERE id=$3 RETURNING id,state,external_evidence_reference',[next,req.body.evidenceReference,req.params.quoteId]);
   await client.query('INSERT INTO commercial_evidence_audit(request_id,action,before_data,after_data) VALUES($1,$2,$3,$4)',[req.params.id,'QUOTE_STATE_RECORDED',old,updated.rows[0]]);
   await client.query('COMMIT');return res.json({quote:updated.rows[0],externalEvidenceNotIndependentlyVerified:true,paymentVerified:false,executionEnabled:false});
  } catch {await client.query('ROLLBACK').catch(()=>{});return fail(res);}finally{client.release();}
 });
}
