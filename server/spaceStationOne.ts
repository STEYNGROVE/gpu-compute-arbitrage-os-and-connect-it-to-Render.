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


<!-- SPACE_STATION_V3_EVIDENCE -->
<section>
<h2>V3 — Evidence Command</h2>
<p>
Authenticated records, not assumed income.
All actions in this panel are read-only.
</p>

<div class="grid">
<div class="card">
<h2>Recorded Enquiries</h2>
<strong id="v3-count">UNKNOWN</strong>
</div>
<div class="card">
<h2>Execution Mode</h2>
<strong id="v3-mode">UNKNOWN</strong>
</div>
<div class="card">
<h2>Approval Storage</h2>
<strong id="v3-storage">UNKNOWN</strong>
</div>
<div class="card">
<h2>Revenue Verification</h2>
<strong id="v3-revenue">NOT VERIFIED</strong>
</div>
</div>

<h2>Customer Pipeline</h2>
<p>
Records may include tests and unverified
enquiries. No automatic outreach occurs.
</p>
<div id="v3-customers">Not checked</div>

<h2>Approval States</h2>
<pre id="v3-approvals">Not checked</pre>

<h2>GPU Supplier Evidence</h2>
<pre id="v3-suppliers">Not checked</pre>

<h2>Integration Diagnostics</h2>
<pre id="v3-diagnostics">Not checked</pre>

<button id="v3-refresh" type="button">
Refresh Evidence Command
</button>
</section>

<script>
'use strict';
(function(){
const el=id=>document.getElementById(id);
const show=(id,value)=>{
  el(id).textContent=String(value);
};

async function get(path){
  const controller=new AbortController();
  const timer=setTimeout(
    ()=>controller.abort(),12000
  );

  try{
    const response=await fetch(path,{
      method:'GET',
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

function safeCounts(x){
  if(!x || typeof x!=='object' ||
     Array.isArray(x)){
    return null;
  }

  const result=[];
  for(const [key,value] of Object.entries(x)){
    if(typeof value!=='number' ||
       !Number.isSafeInteger(value) ||
       value<0){
      return null;
    }
    result.push([key,value]);
  }
  return result;
}

function customerCard(record){
  const card=document.createElement('article');
  card.className='card';

  const title=document.createElement('h3');
  title.textContent=String(
    record.company||'Unnamed enquiry'
  );
  card.append(title);

  const fields=[
    ['status','Status'],
    ['workload','Workload'],
    ['gpu_model','Requested GPU'],
    ['gpu_count','GPU count'],
    ['hours','Requested hours'],
    ['created_at','Received']
  ];

  for(const [field,label] of fields){
    const p=document.createElement('p');
    p.textContent=label+': '+
      String(record[field]??'Not provided');
    card.append(p);
  }

  return card;
}

function supplierSummary(s){
  const name=String(s.supplier??'UNKNOWN');
  const authenticated=s.authenticated===true;
  const verified=s.balanceEvidenceVerified===true;
  const amount=typeof s.balanceUsd==='number' &&
    Number.isFinite(s.balanceUsd) &&
    s.balanceUsd>=0 ? s.balanceUsd : null;

  return [
    'Supplier: '+name,
    'Authenticated: '+authenticated,
    'Balance evidence verified: '+verified,
    'Balance USD: '+
      (verified && amount!==null
        ? amount.toFixed(2)
        : 'NOT VERIFIED'),
    'Auto-charge disabled verified: '+
      (s.autoChargeDisabledVerified===true),
    'Billing mode: '+
      String(s.billingMode??'UNKNOWN'),
    'Diagnostic: '+
      String(s.errorCode??'NONE REPORTED'),
    'Checked: '+String(s.checkedAt??'UNKNOWN')
  ].join('\\n');
}

async function refresh(){
  const button=el('v3-refresh');
  button.disabled=true;

  show('v3-diagnostics','Checking...');
  show('v3-count','UNKNOWN');
  show('v3-mode','UNKNOWN');
  show('v3-storage','UNKNOWN');
  show('v3-revenue','NOT VERIFIED');
  show('v3-customers','Loading...');
  show('v3-approvals','Loading...');
  show('v3-suppliers','Loading...');

  const paths=[
    '/api/owner/operations-summary',
    '/api/commercial/requests',
    '/api/owner/supplier-balances'
  ];

  const results=await Promise.allSettled(
    paths.map(get)
  );

  const messages=[];

  if(results[0].status==='fulfilled'){
    const d=results[0].value;

    if(d.environment==='SIMULATION_ONLY' &&
       d.executionEnabled===false){

      show('v3-mode','SIMULATION ONLY');
      show('v3-storage',
        d.approvalStorageInitialized===true
          ? 'INITIALIZED'
          : 'NOT INITIALIZED');

      const quoteCounts=safeCounts(d.quoteRequests);
      if(quoteCounts){
        const total=quoteCounts.reduce(
          (n,p)=>n+p[1],0
        );
        show('v3-count',total);
      }

      const approvals=safeCounts(d.approvals);
      show('v3-approvals',
        d.approvalStorageInitialized!==true
          ? 'Approval storage not initialized'
          : approvals===null
            ? 'Approval schema unavailable'
            : approvals.length===0
              ? 'No approval records'
              : approvals.map(
                  p=>p[0]+': '+p[1]
                ).join('\\n'));

      show('v3-revenue',
        d.revenueVerificationStatus==='NOT_VERIFIED'
          ? 'NOT VERIFIED'
          : 'REVIEW REQUIRED');

      messages.push('Operations: CONNECTED');
    }else{
      messages.push(
        'Operations: SAFETY MISMATCH'
      );
    }
  }else{
    show('v3-approvals','UNAVAILABLE');
    messages.push(
      'Operations: '+String(results[0].reason)
    );
  }

  if(results[1].status==='fulfilled' &&
     Array.isArray(results[1].value.requests)){

    const records=results[1].value.requests;
    const holder=el('v3-customers');
    holder.replaceChildren();

    const grid=document.createElement('div');
    grid.className='grid';

    for(const record of records){
      grid.append(customerCard(record));
    }

    if(records.length){
      holder.append(grid);
    }else{
      holder.textContent='No enquiries returned';
    }

    messages.push(
      'Customer records: '+records.length
    );
  }else{
    show('v3-customers',
      'Customer records unavailable');
    messages.push(
      'Customer API: UNAVAILABLE'
    );
  }

  if(results[2].status==='fulfilled'){
    const d=results[2].value;

    if(d.mode==='READ_ONLY' &&
       d.procurementBlocked===true &&
       d.payoutsBlocked===true &&
       d.tradingBlocked===true &&
       Array.isArray(d.suppliers)){

      show('v3-suppliers',
        d.suppliers.length
          ? d.suppliers.map(
              supplierSummary
            ).join('\\n\\n')
          : 'No supplier diagnostics returned');

      messages.push(
        'Supplier diagnostics: CONNECTED'
      );
    }else{
      show('v3-suppliers',
        'SAFETY RESPONSE MISMATCH');
      messages.push(
        'Supplier diagnostics: REVIEW REQUIRED'
      );
    }
  }else{
    show('v3-suppliers','UNAVAILABLE');
    messages.push(
      'Supplier diagnostics: UNAVAILABLE'
    );
  }

  messages.push(
    'Checked: '+new Date().toISOString()
  );

  show('v3-diagnostics',messages.join('\\n'));
  button.disabled=false;
}

el('v3-refresh').addEventListener(
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
