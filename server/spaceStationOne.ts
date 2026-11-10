import type {
  Express,
  Request,
  Response,
  NextFunction
} from 'express';

type Auth = (
  req: Request,
  res: Response,
  next: NextFunction
) => void;

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport"
 content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>SPACE STATION ONE</title>
<style>
:root {
  color-scheme:dark;
  font-family:system-ui,sans-serif;
  background:#07111f;
  color:#edf5ff;
}
* { box-sizing:border-box }
body {
  max-width:1200px;
  margin:auto;
  padding:20px;
}
header {
  padding:25px 0;
  border-bottom:1px solid #29415c;
}
h1 { font-size:clamp(2rem,6vw,3.4rem) }
h2 { font-size:1.1rem }
small,p { color:#a8c0d9 }
.grid {
  display:grid;
  grid-template-columns:
    repeat(auto-fit,minmax(240px,1fr));
  gap:15px;
  margin-top:25px;
}
.card {
  display:block;
  background:#12243a;
  border:1px solid #31506d;
  border-radius:16px;
  padding:20px;
  color:inherit;
  text-decoration:none;
}
.card:hover {
  border-color:#58d6bd;
  background:#18324d;
}
.banner {
  padding:16px;
  border:1px solid #97752c;
  background:#30260f;
  border-radius:12px;
  margin-top:20px;
}
.status {
  background:#102a27;
  color:#76e8c5;
  border-radius:8px;
  padding:8px 12px;
  display:inline-block;
}
button {
  background:#2468a8;
  color:white;
  padding:12px;
  border:0;
  border-radius:9px;
  cursor:pointer;
}
pre {
  white-space:pre-wrap;
  overflow-wrap:anywhere;
  background:#102137;
  padding:15px;
  border-radius:12px;
}
</style>
</head>
<body>
<header>
<small>OWNER OPERATIONS • EVIDENCE FIRST</small>
<h1>SPACE STATION ONE</h1>
<p>Unified GPU Compute Business Command</p>
<span class="status">READ-ONLY CONTROL PLANE</span>
</header>

<div class="banner">
<strong>Financial safety enforced by policy.</strong>
<p>
No verified customer demand means no GPU purchase.
This interface does not initiate purchasing,
trading, withdrawals or payments.
</p>
</div>

<section class="grid">
<a class="card" href="/owner/command-centre">
<h2>Mission Command</h2>
<p>Operational summaries and approval evidence.</p>
</a>

<a class="card" href="/owner/sales">
<h2>Customer Acquisition</h2>
<p>Real enquiry records and sales workflow.</p>
</a>

<a class="card" href="/owner/gpu-hunter-x">
<h2>GPU Hunter X</h2>
<p>Discovery, qualification and evidence.</p>
</a>

<a class="card" href="/">
<h2>GPU Intelligence</h2>
<p>Existing pricing, supplier and fleet screens.</p>
</a>

<a class="card" href="/request-quote">
<h2>Customer Intake</h2>
<p>Existing public enquiry form.</p>
</a>

<a class="card" href="/owner/command-centre">
<h2>Financial Evidence</h2>
<p>Review approvals; never infer settled profit.</p>
</a>
</section>

<section>
<h2>Live infrastructure</h2>
<button id="refresh" type="button">
Refresh verified health
</button>
<pre id="health">Not queried</pre>
</section>

<section>
<h2>Commercial verification</h2>
<pre>
Verified customer payments: NOT ESTABLISHED
Provider balances: NOT ESTABLISHED
Settled revenue: NOT ESTABLISHED
GPU purchasing: NOT AVAILABLE HERE
</pre>
</section>

<script>
'use strict';
const button=document.getElementById('refresh');
const output=document.getElementById('health');
async function refresh(){
  button.disabled=true;
  output.textContent='Checking readiness...';
  try {
    const response=await fetch('/api/ready',{
      credentials:'same-origin',
      cache:'no-store',
      headers:{Accept:'application/json'}
    });
    if(!response.ok) throw Error(
      'Readiness HTTP '+response.status
    );
    const data=await response.json();
    output.textContent=[
      'Application: '+String(data.status??'unknown'),
      'Database reported: '+String(
        data.database??'unknown'
      ),
      'Revision: '+String(
        data.revision??'unknown'
      ),
      'Checked: '+new Date().toISOString()
    ].join('\\n');
  } catch(error) {
    output.textContent='Verification unavailable: '+
      String(error);
  } finally {
    button.disabled=false;
  }
}
button.addEventListener('click',refresh);
refresh();
</script>



<!-- SPACE_STATION_V4_INTELLIGENCE -->
<section id="v4-command">
<h2>V4 — Commercial Intelligence & Safety</h2>
<p>
Live authenticated read-only intelligence.
Enquiries are not contracts. Supplier credits
are not revenue. No purchasing is authorized.
</p>

<div class="grid">
<div class="card">
<h2>Enquiry Records</h2>
<strong id="v4-enquiries">UNKNOWN</strong>
</div>

<div class="card">
<h2>Unique Demand Groups</h2>
<strong id="v4-groups">UNKNOWN</strong>
</div>

<div class="card">
<h2>Potential Duplicates</h2>
<strong id="v4-duplicates">UNKNOWN</strong>
</div>

<div class="card">
<h2>Verified Supplier Credits</h2>
<strong id="v4-credits">NOT VERIFIED</strong>
</div>

<div class="card">
<h2>Billing Safety</h2>
<strong id="v4-billing">NOT VERIFIED</strong>
</div>

<div class="card">
<h2>Execution Permission</h2>
<strong id="v4-execution">BLOCKED</strong>
</div>
</div>

<h2>Customer Qualification Intelligence</h2>
<p>
Matching enquiries are grouped for review.
Grouping does not prove that two records
belong to the same real customer.
</p>
<div id="v4-pipeline">Not checked</div>

<h2>Supplier Safety & Credit Evidence</h2>
<pre id="v4-suppliers">Not checked</pre>

<h2>Approvals & Revenue Evidence</h2>
<pre id="v4-approvals">Not checked</pre>

<h2>Operational Risk Register</h2>
<pre id="v4-risks">Not checked</pre>

<h2>Integration Diagnostics</h2>
<pre id="v4-health">Not checked</pre>

<button id="v4-refresh" type="button">
Refresh V4 Intelligence
</button>
</section>

<script>
'use strict';

(function(){
const byId=id=>document.getElementById(id);
const set=(id,value)=>{
  byId(id).textContent=String(value);
};
const newline=String.fromCharCode(10);

function safeText(value){
  if(value===null || value===undefined){
    return 'UNKNOWN';
  }
  return String(value);
}

function numeric(value){
  return typeof value==='number' &&
    Number.isFinite(value) &&
    value>=0 ? value : null;
}

async function fetchJson(path){
  const controller=new AbortController();
  const timer=setTimeout(
    ()=>controller.abort(),12000
  );

  try{
    const response=await fetch(path,{
      credentials:'same-origin',
      cache:'no-store',
      headers:{Accept:'application/json'},
      signal:controller.signal
    });

    if(!response.ok){
      throw Error('HTTP '+response.status);
    }

    return await response.json();
  }finally{
    clearTimeout(timer);
  }
}

function element(tag,value){
  const node=document.createElement(tag);
  node.textContent=safeText(value);
  return node;
}

function normalize(value){
  return String(value??'')
    .trim()
    .toLowerCase()
    .replace(/\s+/g,' ');
}

function signature(r){
  return [
    normalize(r.company),
    normalize(r.workload),
    normalize(r.gpu_model),
    normalize(r.gpu_count),
    normalize(r.hours)
  ].join('|');
}

function demandGroups(records){
  const map=new Map();

  for(const record of records){
    const key=signature(record);

    if(!map.has(key)){
      map.set(key,[]);
    }

    map.get(key).push(record);
  }

  return Array.from(map.values());
}

function renderPipeline(records){
  const holder=byId('v4-pipeline');
  holder.replaceChildren();

  const groups=demandGroups(records);

  set('v4-enquiries',records.length);
  set('v4-groups',groups.length);
  set('v4-duplicates',
    records.length-groups.length);

  const grid=document.createElement('div');
  grid.className='grid';

  for(const group of groups){
    const r=group[0];
    const card=document.createElement('article');
    card.className='card';

    card.append(element(
      'h3',r.company||'Unnamed enquiry'
    ));

    const fields=[
      ['Records',group.length],
      ['Status',group.map(
        x=>x.status||'UNKNOWN'
      ).join(', ')],
      ['Workload',r.workload],
      ['GPU model',r.gpu_model],
      ['GPU count',r.gpu_count],
      ['Hours',r.hours]
    ];

    const gpu=numeric(Number(r.gpu_count));
    const hours=numeric(Number(r.hours));

    if(gpu!==null && hours!==null &&
       gpu>0 && hours>0){
      fields.push([
        'GPU-hours per request',
        gpu*hours
      ]);
    }

    for(const [label,value] of fields){
      card.append(element(
        'p',label+': '+safeText(value)
      ));
    }

    const isTest=normalize(r.company)
      .includes('test');

    let assessment='UNVERIFIED ENQUIRY';

    if(isTest){
      assessment='POSSIBLE TEST RECORD';
    }else if(group.length>1){
      assessment='POTENTIAL DUPLICATES';
    }

    card.append(element(
      'strong','Assessment: '+assessment
    ));

    grid.append(card);
  }

  if(groups.length===0){
    holder.textContent='No enquiries returned';
  }else{
    holder.append(grid);
  }

  return {
    groups:groups.length,
    duplicates:records.length-groups.length
  };
}

function supplierLines(s){
  const verified=s.balanceEvidenceVerified===true;
  const balance=numeric(s.balanceUsd);

  return [
    'Supplier: '+safeText(s.supplier),
    'API authenticated: '+(s.authenticated===true),
    'Balance evidence: '+(verified?'VERIFIED':'UNVERIFIED'),
    'Credit USD: '+(
      verified && balance!==null
        ? balance.toFixed(2)
        : 'NOT VERIFIED'
    ),
    'Billing mode: '+safeText(s.billingMode),
    'Auto-charge disabled verified: '+
      (s.autoChargeDisabledVerified===true),
    'Diagnostic: '+safeText(s.errorCode),
    'Checked: '+safeText(s.checkedAt)
  ].join(newline);
}

async function refresh(){
  const button=byId('v4-refresh');
  button.disabled=true;

  for(const id of [
    'v4-enquiries',
    'v4-groups',
    'v4-duplicates'
  ]){
    set(id,'UNKNOWN');
  }

  set('v4-credits','NOT VERIFIED');
  set('v4-billing','NOT VERIFIED');
  set('v4-execution','BLOCKED');
  set('v4-pipeline','Loading...');
  set('v4-suppliers','Loading...');
  set('v4-approvals','Loading...');
  set('v4-risks','Checking...');
  set('v4-health','Checking...');

  const risks=[];
  const diagnostics=[];

  const results=await Promise.allSettled([
    fetchJson('/api/owner/operations-summary'),
    fetchJson('/api/commercial/requests'),
    fetchJson('/api/owner/supplier-balances')
  ]);

  if(results[0].status==='fulfilled'){
    const d=results[0].value;

    if(d.environment==='SIMULATION_ONLY' &&
       d.executionEnabled===false){

      const states=d.approvals;

      if(states &&
         typeof states==='object' &&
         !Array.isArray(states)){

        const lines=Object.entries(states)
          .map(([state,count])=>
            state+': '+safeText(count));

        set('v4-approvals',[
          'Approval storage: '+
            (d.approvalStorageInitialized===true
              ? 'INITIALIZED'
              : 'NOT INITIALIZED'),
          ...lines,
          'Revenue: '+
            safeText(d.revenueVerificationStatus),
          'Verified revenue USD: '+
            (d.verifiedRevenueUsd===null
              ? 'NOT VERIFIED'
              : 'REQUIRES INDEPENDENT REVIEW')
        ].join(newline));
      }else{
        set('v4-approvals',
          'Approval schema unavailable');
      }

      diagnostics.push(
        'Operations: CONNECTED / SIMULATION'
      );

      risks.push(
        'No verified settled revenue established'
      );
    }else{
      set('v4-approvals',
        'SAFETY STATUS MISMATCH');
      risks.push(
        'CRITICAL: Execution mode requires review'
      );
    }
  }else{
    set('v4-approvals','UNAVAILABLE');
    risks.push(
      'Operations evidence unavailable'
    );
  }

  if(results[1].status==='fulfilled' &&
     Array.isArray(results[1].value.requests)){

    const records=results[1].value.requests;
    const summary=renderPipeline(records);

    diagnostics.push(
      'Customer API: CONNECTED'
    );

    if(summary.duplicates>0){
      risks.push(
        'Potential duplicate enquiries: '+
        summary.duplicates
      );
    }

    risks.push(
      'Customer identity and payments not verified'
    );
  }else{
    set('v4-pipeline',
      'Customer records unavailable');
    risks.push(
      'Customer API unavailable'
    );
  }

  if(results[2].status==='fulfilled'){
    const d=results[2].value;

    const safeEnvelope=
      d.mode==='READ_ONLY' &&
      d.procurementBlocked===true &&
      d.payoutsBlocked===true &&
      d.tradingBlocked===true &&
      Array.isArray(d.suppliers);

    if(safeEnvelope){
      let creditTotal=0;
      let verifiedCount=0;
      let billingSafe=true;

      const lines=[];

      for(const supplier of d.suppliers){
        lines.push(supplierLines(supplier));

        const balance=numeric(
          supplier.balanceUsd
        );

        if(supplier.authenticated===true &&
           supplier.balanceEvidenceVerified===true &&
           balance!==null){

          creditTotal+=balance;
          verifiedCount++;
        }

        if(supplier.autoChargeDisabledVerified
           !==true){

          billingSafe=false;

          risks.push(
            safeText(supplier.supplier)+
            ': automatic charging not verified disabled'
          );
        }

        if(supplier.errorCode){
          risks.push(
            safeText(supplier.supplier)+
            ': '+safeText(supplier.errorCode)
          );
        }
      }

      set('v4-suppliers',
        lines.join(newline+newline) ||
        'No supplier results');

      set('v4-credits',
        verifiedCount===d.suppliers.length &&
        verifiedCount>0
          ? '$'+creditTotal.toFixed(2)
          : 'PARTIAL / UNVERIFIED');

      set('v4-billing',
        billingSafe && d.suppliers.length>0
          ? 'API CHECKS PASSED'
          : 'NOT VERIFIED SAFE');

      diagnostics.push(
        'Supplier API: CONNECTED'
      );
    }else{
      set('v4-suppliers',
        'SAFETY RESPONSE MISMATCH');

      risks.push(
        'Supplier safety envelope mismatch'
      );
    }
  }else{
    set('v4-suppliers','UNAVAILABLE');
    risks.push(
      'Supplier diagnostics unavailable'
    );
  }

  risks.push(
    'GPU purchasing remains unavailable'
  );

  set('v4-risks',risks.join(newline));
  set('v4-health',[
    ...diagnostics,
    'Execution permission: BLOCKED',
    'Read-only intelligence: ACTIVE',
    'Checked: '+new Date().toISOString()
  ].join(newline));

  button.disabled=false;
}

byId('v4-refresh').addEventListener(
  'click',refresh
);

refresh();
})();
</script>

</body>
</html>`;

export function registerSpaceStationOne(
  app: Express,
  requireOwnerAuth: Auth
) {
  app.get(
    '/owner/space-station',
    requireOwnerAuth,
    (_req: Request,res: Response) => {
      res.setHeader('Cache-Control','no-store');
      res.setHeader(
        'X-Content-Type-Options','nosniff'
      );
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; "+
        "script-src 'unsafe-inline'; "+
        "style-src 'unsafe-inline'; "+
        "connect-src 'self'; "+
        "base-uri 'none'; "+
        "frame-ancestors 'none'; "+
        "form-action 'none'"
      );
      res.type('html').send(page);
    }
  );
}
