import type { Express, Request, Response, NextFunction } from 'express';
import {applicationDatabase} from './applicationDatabase.js';
import crypto from 'node:crypto';

type Owner = (req: Request, res: Response, next: NextFunction) => void;
function getEvidencePool() {return applicationDatabase;}
const limited = (x:unknown,n:number) => typeof x === 'string' ? x.trim().slice(0,n) : '';
function safeUrl(x:string):boolean {
  try {const u=new URL(x); return u.protocol==='https:' && !u.username && !u.password && (!u.port || u.port==='443') && /^[a-z0-9.-]+$/i.test(u.hostname) && u.hostname.includes('.') && !u.hostname.endsWith('.local') && !u.hostname.endsWith('.internal') && !/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname);} catch{return false;}
}
export function classifyBuyerEvidence(title:string, description:string, source:string) {
  const t=(title+' '+description).replace(/<[^>]*>/g,' ').replace(/&(?:quot|amp|lt|gt|#\d+|#x[\da-f]+);/gi,' ');
  const discussionSource = /hacker\s*news|ycombinator|forum|reddit/i.test(source);

  const hardware=/\b(?:gpu|h100|h200|a100|b100|b200|gb200|rtx\s*4090|rtx\s*5090)\b/i.test(t);
  const service=/\b(?:gpu\s*(?:cloud|rental|hosting|capacity|instances?|cluster|compute)|cloud\s*gpu|compute\s*(?:capacity|rental|hosting|cluster)|rent(?:ing)?\s+(?:an?\s+)?(?:h100|h200|a100|gpu)|h100\s*(?:instances?|rental|cloud))\b/i.test(t);
  const request=/\b(?:we\s+(?:need|seek|are\s+looking\s+for|want\s+to\s+rent)|i\s+(?:need|am\s+looking\s+for|want\s+to\s+rent)|looking\s+to\s+(?:rent|buy)|request\s+for\s+(?:proposal|quotation)|seeking\s+(?:quotes?|bids?|providers?|capacity)|(?:rfp|rfq|tender)\s+(?:for|to\s+provide)|please\s+(?:quote|bid)|invitation\s+to\s+bid)\b/i.test(t);
  const supplier=/\b(?:we\s+(?:offer|provide|rent\s+out|sell)|our\s+(?:gpu|cloud|hosting)\s+(?:service|platform)|available\s+for\s+rent|rent\s+out\s+(?:gpu|vm)|selling\s+gpu\s+capacity)\b/i.test(t);
  const employment=/\b(?:we\s+are\s+hiring|job\s+opening|vacancy|resume|salary|looking\s+for\s+(?:an?\s+)?(?:engineer|developer))\b/i.test(t);
  const technical=/\b(?:bug|stack\s+trace|shader|kernel\s+panic|pull\s+request|feature\s+request|benchmark|tutorial)\b/i.test(title);
  let category='DISCUSSION_ONLY';
  if (employment) category='EMPLOYMENT';
  else if (supplier && !request) category='SUPPLIER_OFFER';
  else if (hardware && service && request && !technical && !supplier && !discussionSource) category='BUYER_REQUEST_REVIEW';
  return {category, buyerIntentConfirmed:false, verifiedCustomer:false, evidenceStatus:'UNVERIFIED', source};
}
async function ready(){
  const db = getEvidencePool();
  await db.query('SELECT id FROM gpu_buyer_evidence_review LIMIT 0');
}
export function registerBuyerEvidenceImport(app:Express, owner:Owner){
  app.post('/api/owner/gpu-hunter-x/import-evidence',owner,async(req,res)=>{
    const records=req.body?.records;
    if(!Array.isArray(records)||records.length>200||records.length===0) return res.status(400).json({error:'INVALID_BATCH'});
    const rows: Array<{url:string;source:string;title:string;description:string;posted:string|null;category:string;original:string}> = [];
    for(const x of records){
      if(!x || typeof x!=='object')return res.status(400).json({error:'INVALID_RECORD'});
      const url=limited(x.source_url,800), source=limited(x.source,100), title=limited(x.title,240), description=limited(x.description,4000);
      const posted=limited(x.posted_date,50);
      if(!safeUrl(url)||!source||!title||(posted && !Number.isFinite(Date.parse(posted))))return res.status(400).json({error:'INVALID_RECORD'});
      const category=classifyBuyerEvidence(title,description,source).category;
      rows.push({url,source,title,description,posted:posted||null,category,original:limited(x.original_category||x.category,80)});
    }
    try{
      await ready(); let inserted=0,duplicates=0;
      for(const r of rows){
        const id=crypto.createHash('sha256').update(r.url).digest('hex');
        const q=await getEvidencePool().query(`INSERT INTO gpu_buyer_evidence_review(id,source_url,source_name,title,description,posted_date,category,original_category)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(source_url) DO NOTHING`,[id,r.url,r.source,r.title,r.description,r.posted,r.category,r.original]);
        if(q.rowCount)inserted++;else duplicates++;
      }
      res.setHeader('Cache-Control','no-store');
      res.json({mode:'SIMULATION_ONLY',inserted,duplicates,verifiedCustomers:0,realizedRevenueUsd:0,automatedOutreachEnabled:false,procurementEnabled:false});
    }catch(e){
      const err = e as { code?: string; name?: string };
      console.error('[GPU EVIDENCE STORAGE]', {
        code: err?.code || 'UNKNOWN',
        name: err?.name || 'Error'
      });
      res.status(503).json({error:'EVIDENCE_STORAGE_UNAVAILABLE'});
    }
  });
  app.get('/api/owner/gpu-hunter-x/evidence-review',owner,async(_req,res)=>{
    try{await ready();const q=await getEvidencePool().query('SELECT id,source_url,source_name,title,description,posted_date,category,original_category,reviewed,created_at FROM gpu_buyer_evidence_review ORDER BY created_at DESC LIMIT 200');res.setHeader('Cache-Control','no-store');res.json({mode:'SIMULATION_ONLY',verifiedCustomers:0,realizedRevenueUsd:0,records:q.rows});}
    catch(e){
      const err = e as { code?: string; name?: string };
      console.error('[GPU EVIDENCE STORAGE]', {
        code: err?.code || 'UNKNOWN',
        name: err?.name || 'Error'
      });
      res.status(503).json({error:'EVIDENCE_STORAGE_UNAVAILABLE'});
    }
  });
}
