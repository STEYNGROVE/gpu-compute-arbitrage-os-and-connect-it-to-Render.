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
