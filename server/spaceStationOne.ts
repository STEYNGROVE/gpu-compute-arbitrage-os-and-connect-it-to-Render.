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

<!-- SPACE_STATION_V2_LIVE_INTELLIGENCE -->
<section class="live-intelligence">
<h2>Live Business Intelligence</h2>
<p>
Authenticated read-only records.
Administrative counts are not revenue.
</p>

<div class="grid">
<div class="card">
<h2>Customer Enquiries</h2>
<strong id="v2-enquiries">UNKNOWN</strong>
</div>

<div class="card">
<h2>Pending Approvals</h2>
<strong id="v2-pending">UNKNOWN</strong>
</div>

<div class="card">
<h2>Verified Approvals</h2>
<strong id="v2-approved">UNKNOWN</strong>
</div>

<div class="card">
<h2>Commercial Execution</h2>
<strong id="v2-execution">UNKNOWN</strong>
</div>
</div>

<h2>GPU Supplier Diagnostics</h2>
<pre id="v2-suppliers">Not checked</pre>

<h2>Evidence Integrity</h2>
<pre id="v2-evidence">
Revenue: NOT VERIFIED
Payments: NOT VERIFIED
Customer contracts: NOT VERIFIED
</pre>

<h2>Integration Health</h2>
<pre id="v2-status">Not checked</pre>

<button id="v2-refresh" type="button">
Refresh Live Intelligence
</button>
</section>

<script>
'use strict';

(function(){
const get=id=>document.getElementById(id);
const put=(id,value)=>{
  get(id).textContent=String(value);
};

async function requestJson(path){
  const controller=new AbortController();
  const timeout=setTimeout(
    ()=>controller.abort(),15000
  );
  try {
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
  } finally {
    clearTimeout(timeout);
  }
}

function total(counts){
  if(!counts ||
     typeof counts!=='object' ||
     Array.isArray(counts)){
    return null;
  }

  let sum=0;
  for(const value of Object.values(counts)){
    if(typeof value!=='number' ||
       !Number.isSafeInteger(value) ||
       value<0){
      return null;
    }
    sum+=value;
  }
  return sum;
}

async function refresh(){
  const button=get('v2-refresh');
  button.disabled=true;

  put('v2-status','Refreshing...');
  put('v2-enquiries','UNKNOWN');
  put('v2-pending','UNKNOWN');
  put('v2-approved','UNKNOWN');
  put('v2-execution','UNKNOWN');
  put('v2-suppliers','Checking...');

  const results=await Promise.allSettled([
    requestJson('/api/owner/operations-summary'),
    requestJson('/api/owner/supplier-balances')
  ]);

  const messages=[];

  if(results[0].status==='fulfilled'){
    const d=results[0].value;

    if(d.environment==='SIMULATION_ONLY' &&
       d.executionEnabled===false){

      const enquiries=total(d.quoteRequests);
      const approvals=d.approvals||{};

      put('v2-enquiries',
        enquiries===null?'UNKNOWN':enquiries);

      put('v2-pending',
        approvals.PENDING_VERIFICATION??'UNKNOWN');

      put('v2-approved',
        approvals.APPROVAL_VERIFIED??'UNKNOWN');

      put('v2-execution','SIMULATION ONLY');

      messages.push('Operations: CONNECTED');
    }else{
      messages.push(
        'Operations: SAFETY STATUS MISMATCH'
      );
    }
  }else{
    messages.push(
      'Operations: UNAVAILABLE ('+
      String(results[0].reason)+')'
    );
  }

  if(results[1].status==='fulfilled'){
    const d=results[1].value;

    if(d.mode==='READ_ONLY' &&
       d.procurementBlocked===true &&
       d.payoutsBlocked===true &&
       d.tradingBlocked===true &&
       Array.isArray(d.suppliers)){

      const lines=d.suppliers.map(
        (supplier,index)=>{
          const name=String(
            supplier.provider??
            supplier.supplier??
            'Supplier '+(index+1)
          );

          const status=String(
            supplier.status??
            supplier.verificationStatus??
            'UNKNOWN'
          );

          return name+': '+status;
        }
      );

      put('v2-suppliers',
        lines.join('\\n') ||
        'No supplier results');

      messages.push(
        'Supplier diagnostics: CONNECTED'
      );
    }else{
      put('v2-suppliers',
        'Safety response mismatch; data withheld');

      messages.push(
        'Supplier diagnostics: REVIEW REQUIRED'
      );
    }
  }else{
    put('v2-suppliers',
      'UNAVAILABLE: '+String(results[1].reason));

    messages.push(
      'Supplier diagnostics: UNAVAILABLE'
    );
  }

  put('v2-status',
    messages.join('\\n')+
    '\\nChecked: '+new Date().toISOString()
  );

  button.disabled=false;
}

get('v2-refresh').addEventListener(
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
