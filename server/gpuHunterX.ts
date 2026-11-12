import {configuredApplicationDatabase} from './applicationDatabase.js';
import type { Express, Request, Response, NextFunction } from 'express';

import crypto from 'node:crypto';

type Auth = (req: Request, res: Response, next: NextFunction) => void;
const pool=configuredApplicationDatabase();
let setup: Promise<unknown> | undefined;
const clean = (x: unknown, n: number) => typeof x === 'string' ? x.trim().slice(0,n) : '';
const publicUrl = (value: string) => {
  try { const u = new URL(value); if (u.protocol !== 'https:' || u.username || u.password || u.port && u.port !== '443') return false;
    const h = u.hostname.toLowerCase();
    if (!h.includes('.') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || /^\d+(\.\d+){3}$/.test(h) || h.includes(':') || h.startsWith('127.') || h.startsWith('10.') || h.startsWith('192.168.')) return false;
    return true;
  } catch { return false; }
};
async function ready() {
  if (!pool) throw Error('DATABASE_URL_NOT_CONFIGURED');
  if (!setup) setup = pool.query('SELECT id,company,source_url,evidence,workload,contact_channel,deadline,budget_evidence,score,score_reasons,status,created_at FROM gpu_hunter_opportunities LIMIT 0').catch(e => { setup = undefined; throw e; });
  await setup;
}
function score(b: { evidence:string; workload:string; deadline:string; budgetEvidence:string; contactChannel:string }) {
  const reasons: string[] = []; let points = 0;
  if (/gpu|h100|a100|b200|inference|training|cuda|render|compute/i.test(b.workload)) {points += 25; reasons.push('GPU-specific workload');}
  if (b.evidence.length >= 80) {points += 15; reasons.push('Detailed evidence supplied');}
  if (/tender|rfp|request for proposal|procurement|quotation|bid/i.test(b.evidence)) {points += 20; reasons.push('Procurement language');}
  if (b.budgetEvidence) {points += 15; reasons.push('Budget evidence supplied (unverified)');}
  if (b.contactChannel) {points += 10; reasons.push('Contact route supplied (unverified)');}
  if (b.deadline) {const ms = Date.parse(b.deadline)-Date.now(); if(ms>0 && ms<=30*86400000) {points += 15; reasons.push('Deadline within 30 days');}}
  return {score: Math.min(100,points),reasons};
}

// Conservative relevance screening, not customer verification.
function rankDiscoveredLead(title: string) {
  const text = title.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  if (/gpu|compute capacity|cloud gpu|gpu rental/.test(text)) {
    score += 20;
    reasons.push('GPU-related terminology');
  }
  if (/h100|h200|a100|b200|cuda/.test(text)) {
    score += 15;
    reasons.push('Specific GPU or CUDA mentioned');
  }
  if (/inference|model training|render farm/.test(text)) {
    score += 10;
    reasons.push('Compute workload mentioned');
  }
  if (/rfp|tender|procurement|looking to rent/.test(text)) {
    score += 25;
    reasons.push('Possible procurement intent');
  }
  if (/budget|paid contract/.test(text)) {
    score += 10;
    reasons.push('Possible budget evidence');
  }
  if (/who is hiring|job opening|salary|recruiting/.test(text)) {
    score = Math.max(0, score - 25);
    reasons.push('Hiring advertisement, not confirmed buyer');
  }

  return {
    score: Math.min(80, score),
    score_reasons: reasons,
    evidenceStatus: 'UNVERIFIED',
    verifiedCustomer: false
  };
}

// GPU_HUNTER_QUALIFICATION_V2
// Evidence-based preliminary ranking.
// No customer, contract or revenue verification is implied.

// GPU_EVIDENCE_V3
function qualifyCandidate(
  title: string,
  sourceFeed: string,
  description: string = ''
) {
  const t = (title + ' ' + description).toLowerCase();
  const feed = sourceFeed.toLowerCase();
  const reasons: string[] = [];

  const hiring = /whoishiring/.test(feed) ||
    /who is hiring|we are hiring|job opening|recruiting|vacancy/.test(t);

  const procurement =
    /request for proposal|request for quotation|\brfp\b|\brfq\b|\btender\b|procurement/.test(t);

  const buying =
    /looking to rent|need gpu capacity|seeking gpu compute|buy compute|rent gpu|gpu provider wanted/.test(t);

  const technical =
    /\bgpu\b|\bcuda\b|\bh100\b|\bh200\b|\ba100\b|\bb200\b|inference|render farm/.test(t);

  let category = 'UNCLASSIFIED';
  let score = 0;

  if (hiring) {
    category = 'EMPLOYMENT';
    reasons.push('Hiring source or employment language');
  } else if (procurement && technical) {
    category = 'POTENTIAL_PROCUREMENT';
    score = 45;
    reasons.push('Procurement and GPU terminology');
  } else if (buying && technical) {
    category = 'POTENTIAL_COMPUTE_DEMAND';
    score = 40;
    reasons.push('Possible compute purchasing intent');
  } else if (technical) {
    category = 'TECHNICAL_MENTION';
    score = 10;
    reasons.push('GPU terminology without confirmed buyer intent');
  }

  if (!description.trim()) {
    reasons.push('Source description missing');
    score = Math.min(score, 10);
  }

  return {
    category,
    score,
    reasons,
    missingEvidence: [
      'Verified buyer identity',
      'Confirmed commercial requirement',
      'Confirmed budget',
      'Confirmed deadline',
      'Confirmed contact route'
    ],
    evidenceStatus: 'UNVERIFIED',
    verifiedCustomer: false,
    verifiedContract: false,
    realizedRevenueUsd: 0
  };
}

export function registerGpuHunterX(app:Express, owner:Auth) {

  // Read-only qualification endpoint.
  app.get('/api/owner/gpu-hunter-x/qualified', owner, async (_req, res) => {
    try {
      await ready();

      const result = await pool!.query(
        `SELECT id, title, source_url, source_feed, description,
                status, discovered_at
         FROM acquisition_leads
         ORDER BY discovered_at DESC
         LIMIT 200`
      );

      const opportunities = result.rows.map(x => ({
        id: x.id,
        title: x.title,
        sourceUrl: x.source_url,
        sourceFeed: x.source_feed,
        description: x.description || '',
        status: x.status,
        discoveredAt: x.discovered_at,
        ...qualifyCandidate(x.title, x.source_feed, x.description || '')
      }));

      opportunities.sort((a, b) => b.score - a.score);

      res.setHeader('Cache-Control', 'no-store');

      res.json({
        mode: 'SIMULATION_ONLY',
        qualificationVersion: 3,
        total: opportunities.length,
        verifiedCustomers: 0,
        realizedRevenueUsd: 0,
        automatedOutreachEnabled: false,
        procurementEnabled: false,
        opportunities
      });
    } catch {
      res.status(503).json({
        error: 'QUALIFICATION_STORAGE_UNAVAILABLE'
      });
    }
  });

  // Unified, read-only view. Existing registries remain intact.
  app.get('/api/owner/gpu-hunter-x/unified', owner, async (_req,res)=>{
    try {
      await ready();
      const [hunter, acquisition, intelligence] = await Promise.all([
        pool!.query('SELECT id,company,source_url,evidence,workload,score,status,created_at FROM gpu_hunter_opportunities ORDER BY created_at DESC LIMIT 200'),
        pool!.query("SELECT id,title,source_url,source_feed,status,discovered_at FROM acquisition_leads ORDER BY discovered_at DESC LIMIT 200"),
        pool!.query('SELECT id,company,source_url,evidence,workload,status,created_at FROM customer_intelligence_leads ORDER BY created_at DESC LIMIT 200')
      ]);
      const merged = new Map<string, Record<string,unknown>>();
      for (const x of acquisition.rows) merged.set(x.source_url, {sourceUrl:x.source_url,title:x.title,sourceFeed:x.source_feed,origin:['ACQUISITION'],status:x.status,discoveredAt:x.discovered_at,verifiedCustomer:false,...rankDiscoveredLead(x.title)});
      for (const x of intelligence.rows) {
        const prev=merged.get(x.source_url)||{};
        merged.set(x.source_url,{...prev,sourceUrl:x.source_url,company:x.company,evidence:x.evidence,workload:x.workload,origin:[...((prev.origin as string[])||[]),'CUSTOMER_INTELLIGENCE'],intelligenceStatus:x.status,verifiedCustomer:false});
      }
      for (const x of hunter.rows) {
        const prev=merged.get(x.source_url)||{};
        merged.set(x.source_url,{...prev,sourceUrl:x.source_url,company:x.company,evidence:x.evidence,workload:x.workload,score:x.score,origin:[...((prev.origin as string[])||[]),'GPU_HUNTER_X'],hunterStatus:x.status,verifiedCustomer:false});
      }
      res.setHeader('Cache-Control','no-store');
      res.json({mode:'SIMULATION_ONLY',automatedOutreachEnabled:false,procurementEnabled:false,verifiedCustomers:0,realizedRevenueUsd:0,discoveryTrigger:'/api/acquisition/discover',opportunities:Array.from(merged.values()).slice(0,300)});
    } catch (_e) {res.status(503).json({error:'UNIFIED_OPPORTUNITY_STORAGE_UNAVAILABLE'});}
  });
  app.get('/api/owner/gpu-hunter-x',owner,async (_req,res)=>{
    try {await ready(); const q=await pool!.query('SELECT id,company,source_url,evidence,workload,contact_channel,deadline,budget_evidence,score,score_reasons,status,created_at FROM gpu_hunter_opportunities ORDER BY score DESC,created_at DESC LIMIT 200');
      res.setHeader('Cache-Control','no-store'); res.json({mode:'SIMULATION_ONLY',automatedOutreachEnabled:false,procurementEnabled:false,discoveryMode:'MANUAL_EVIDENCE_IMPORT',verifiedCustomers:0,realizedRevenueUsd:0,opportunities:q.rows});
    } catch {res.status(503).json({error:'OPPORTUNITY_STORAGE_UNAVAILABLE'});}
  });
  app.post('/api/owner/gpu-hunter-x',owner,async(req,res)=>{
    const b=req.body||{}, company=clean(b.company,120),source=clean(b.sourceUrl,800),evidence=clean(b.evidence,4000),workload=clean(b.workload,400),channel=clean(b.contactChannel,250),budget=clean(b.budgetEvidence,300),deadline=clean(b.deadline,40);
    if (!company||!publicUrl(source)||!evidence||!workload||!channel||(deadline && !Number.isFinite(Date.parse(deadline)))) return res.status(400).json({error:'INVALID_OPPORTUNITY'});
    const result=score({evidence,workload,contactChannel:channel,budgetEvidence:budget,deadline});
    try {await ready(); const q=await pool!.query(`INSERT INTO gpu_hunter_opportunities(id,company,source_url,evidence,workload,contact_channel,deadline,budget_evidence,score,score_reasons) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(source_url) DO NOTHING RETURNING id`,[crypto.randomUUID(),company,source,evidence,workload,channel,deadline||null,budget||null,result.score,JSON.stringify(result.reasons)]);
      if(!q.rowCount)return res.status(409).json({error:'DUPLICATE_SOURCE_URL'});
      res.status(201).json({id:q.rows[0].id,...result,status:'DISCOVERED',verifiedCustomer:false});
    }catch {res.status(503).json({error:'OPPORTUNITY_STORAGE_UNAVAILABLE'});}
  });
  app.patch('/api/owner/gpu-hunter-x/:id',owner,async(req,res)=>{
    const id=req.params.id, status=clean(req.body?.status,30);
    if(!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)||!['DISCOVERED','REVIEWING','QUALIFIED','DISQUALIFIED'].includes(status))return res.status(400).json({error:'INVALID_UPDATE'});
    try {await ready();const q=await pool!.query('UPDATE gpu_hunter_opportunities SET status=$1 WHERE id=$2 RETURNING id,status',[status,id]);if(!q.rowCount)return res.status(404).json({error:'NOT_FOUND'});res.json({...q.rows[0],verifiedCustomer:false});}catch{res.status(503).json({error:'OPPORTUNITY_STORAGE_UNAVAILABLE'});}
  });
  app.get('/owner/gpu-hunter-x',owner,(_req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    res.type('html').send(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>GPU HUNTER X</title><style>body{font:16px system-ui;background:#0b1220;color:#e7f1ff;margin:auto;padding:20px;max-width:900px}a{color:#80caff}article{background:#162338;border:1px solid #34435b;border-radius:12px;padding:15px;margin:12px 0}button{padding:9px;border:0;border-radius:7px;background:#7ac7f9;color:#081420}small{color:#b7c8db}select{padding:8px}h1{margin-bottom:4px}</style><h1>GPU HUNTER X</h1><p>Evidence-backed opportunity ranking · Simulation only · No outreach or purchasing</p><p><a href="/owner/sales">Sales Workspace</a> · <a href="/owner/command-centre">Command Centre</a></p><button id="refresh">Refresh opportunities</button><p id="state">Loading...</p><div id="results"></div><script>

// GPU_HUNTER_DASHBOARD_V2
const root=document.getElementById('results');
const state=document.getElementById('state');

function node(tag,value){
  const e=document.createElement(tag);
  e.textContent=String(value??'');
  return e;
}

async function load(){
  state.textContent='Loading qualified opportunities...';
  root.replaceChildren();

  try{
    const r=await fetch(
      '/api/owner/gpu-hunter-x/qualified',
      {credentials:'same-origin',cache:'no-store'}
    );

    if(!r.ok)throw Error('HTTP '+r.status);

    const d=await r.json();
    const items=d.opportunities||[];

    state.textContent=
      items.length+' discovered candidates | '+
      d.verifiedCustomers+' verified customers | '+
      '$'+d.realizedRevenueUsd+' verified revenue';

    for(const x of items){
      const a=document.createElement('article');

      a.append(
        node('h3',(x.title||'Opportunity')+
          ' · '+x.score+'/100'),
        node('p','Category: '+x.category),
        node('p','Evidence: '+x.evidenceStatus),
        node('p',x.description || 'No source description stored'),
        node('small',(x.reasons||[]).join(' · '))
      );

      const missing=node(
        'p',
        'Missing evidence: '+
        (x.missingEvidence||[]).join(', ')
      );
      a.append(missing);

      if(x.sourceUrl){
        try{
          const u=new URL(x.sourceUrl);
          if(u.protocol==='https:'){
            const link=document.createElement('a');
            link.href=u.href;
            link.target='_blank';
            link.rel='noopener noreferrer';
            link.textContent='Review original source';
            a.append(link);
          }
        }catch{}
      }

      root.append(a);
    }

    if(!items.length){
      root.append(node('p','No candidates discovered yet.'));
    }

  }catch(e){
    state.textContent='Qualification API error: '+String(e);
  }
}

document.getElementById('refresh').onclick=load;
load();
</script></html>`);
  });
}
