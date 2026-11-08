import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';

// Safe, offline, read-only agent runtime. No model keys or external actions needed.
const root = process.cwd();
const registry = JSON.parse(await fs.readFile(path.join(root, 'agents/registry.json'), 'utf8'));
if (registry.operatingMode !== 'SIMULATION_ONLY' || registry.agents.length !== 13 || new Set(registry.agents.map((a: {id:string})=>a.id)).size !== 13) throw new Error('INVALID_AGENT_REGISTRY');
for (const k of ['automatedOutreach','procurement','financialExecution','trading','externalActions']) if (registry.defaults[k] !== false) throw new Error('UNSAFE_AGENT_SETTING:'+k);
const raw = process.argv[2] || path.join(process.env.HOME || root, 'gpu-b2b-leads/multisource/reviewed-results.json');
const parsed = JSON.parse(await fs.readFile(raw, 'utf8'));
const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed.records) ? parsed.records : Array.isArray(parsed.results) ? parsed.results : null;
if (!records) throw new Error('EXPECTED_ARRAY_OR_RECORDS_ARRAY');
const agentIds = registry.agents.map((a: {id:string})=>a.id);
const now = new Date().toISOString();
const classifications = new Map<string, number>();
const candidates: unknown[] = [];
const seen = new Set<string>();
let duplicates = 0;
for (const item of records) {
  if (!item || typeof item !== 'object') continue;
  const r = item as Record<string, unknown>;
  const url = typeof r.source_url === 'string' ? r.source_url : '';
  let u: URL;
  try {u = new URL(url); if (u.protocol !== 'https:' || u.username || u.password) continue;} catch {continue;}
  const id = crypto.createHash('sha256').update(u.href).digest('hex');
  if (seen.has(id)) {duplicates++;continue;}
  seen.add(id);
  const title = String(r.title || '').slice(0,240);
  const description = String(r.description || '').slice(0,4000);
  const source = String(r.source || '').slice(0,100);
  const text = `${title} ${description}`.replace(/<[^>]*>/g,' ').replace(/&(?:gt|lt|amp|quot|#\d+|#x[\da-f]+);/gi,' ');
  const discussion = /hacker\s*news|ycombinator|forum|reddit/i.test(source) || /news\.ycombinator\.com|reddit\.com/i.test(u.hostname);
  const hardware = /\b(?:gpu|h100|h200|a100|b100|b200|gb200|rtx\s*4090|rtx\s*5090)\b/i.test(text);
  const service = /\b(?:gpu\s*(?:cloud|rental|hosting|capacity|instances?|cluster|compute)|cloud\s*gpu|compute\s*(?:capacity|rental|hosting|cluster)|rent(?:ing)?\s+(?:an?\s+)?(?:h100|h200|a100|gpu)|h100\s*(?:instances?|rental|cloud))\b/i.test(text);
  const request = /\b(?:we\s+(?:need|seek|are\s+looking\s+for|want\s+to\s+rent)|i\s+(?:need|am\s+looking\s+for|want\s+to\s+rent)|looking\s+to\s+(?:rent|buy)|request\s+for\s+(?:proposal|quotation)|seeking\s+(?:quotes?|bids?|providers?|capacity)|(?:rfp|rfq|tender)\s+(?:for|to\s+provide)|please\s+(?:quote|bid)|invitation\s+to\s+bid)\b/i.test(text);
  const supplier = /\b(?:we\s+(?:offer|provide|rent\s+out|sell)|our\s+(?:gpu|cloud|hosting)\s+(?:service|platform)|available\s+for\s+rent|rent\s+out\s+(?:gpu|vm)|selling\s+gpu\s+capacity)\b/i.test(text);
  const employment = /\b(?:we\s+are\s+hiring|job\s+opening|vacancy|resume|salary|looking\s+for\s+(?:an?\s+)?(?:engineer|developer))\b/i.test(text);
  const technical = /\b(?:bug|stack\s+trace|shader|kernel\s+panic|pull\s+request|feature\s+request|benchmark|tutorial)\b/i.test(title);
  let category = 'DISCUSSION_ONLY';
  if (employment) category = 'EMPLOYMENT';
  else if (supplier && !request) category = 'SUPPLIER_OFFER';
  else if (hardware && service && request && !technical && !supplier && !discussion) category = 'BUYER_REQUEST_REVIEW';
  classifications.set(category, (classifications.get(category)||0)+1);
  if (category === 'BUYER_REQUEST_REVIEW') candidates.push({id,title,source_url:url,source,category,evidenceStatus:'UNVERIFIED',buyerIntentConfirmed:false});
}
const report = {generatedAt:now, mode:'SIMULATION_ONLY', agentRoles:agentIds.map((id:string)=>({id,status:'REGISTERED_NOT_EXECUTING'})), runtime:'OFFLINE_EVIDENCE_TRIAGE_ONLY', input:raw, recordsRead:records.length, uniqueValidRecords:seen.size, duplicates, categories:Object.fromEntries(classifications), candidates, verifiedCustomers:0, signedContracts:0, realizedRevenueUsd:0, outreachEnabled:false, procurementEnabled:false, financialExecutionEnabled:false};
const out = path.join(root,'reports','agent-triage-report.json');
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({report:out,recordsRead:report.recordsRead,uniqueValidRecords:report.uniqueValidRecords,categories:report.categories,candidates:candidates.length,mode:report.mode},null,2));
