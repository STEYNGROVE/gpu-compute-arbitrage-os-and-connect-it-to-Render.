import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';
import {auditFrontend} from '../scripts/verify-vercel-output.mjs';
import {backendModule, validateBrowserEnvironment, sensitiveContent} from '../scripts/frontend-policy.mjs';
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
const origin='https://gpu-arbitrage-simulation-staging.onrender.com';
// Small offline model of the documented ordered route contract, not Vercel emulation.
function route(raw, method='GET', existing=new Set()) {
  const url=new URL(raw,'https://frontend.example');
  for(const rule of config.routes) {
    if(rule.handle==='filesystem') { if(existing.has(url.pathname)) return url.pathname; continue; }
    if(rule.methods && !rule.methods.includes(method)) continue;
    const pattern=new RegExp('^(?:'+rule.src+')$');
    if(pattern.test(url.pathname)) return url.pathname.replace(pattern,rule.dest)+url.search;
  }
  return null;
}
test('API rules precede static files and SPA; only the fixed HTTPS staging origin is used',()=>{
  for(const method of ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS']) {
    assert.equal(route('/api/auth/session',method,new Set(['/api/auth/session'])),origin+'/api/auth/session');
    assert.equal(route('/api',method),origin+'/api');
    assert.equal(route('/API/auth/session',method),origin+'/api/auth/session');
  }
  assert.equal(route('/api/offers?mode=DISCOVERY_ONLY'),origin+'/api/offers?mode=DISCOVERY_ONLY');
  assert.equal(route('/api/https://untrusted.example'),origin+'/api/https://untrusted.example');
  for(const r of config.routes.filter(r=>r.dest?.startsWith('https:'))) {
    assert.equal(new URL(r.dest).origin,origin);
    assert.equal(r.headers['Cache-Control'],'no-store');
    assert.equal(r.transforms,undefined); assert.equal(r.continue,undefined);
  }
});
test('SPA handles deep links but never missing API/assets or non-GET mutations',()=>{
  assert.equal(route('/owner/readiness'),'/index.html');
  assert.equal(route('/owner/readiness','HEAD'),'/index.html');
  assert.equal(route('/apiculture'),'/index.html');
  assert.equal(route('/assets/app.js','GET',new Set(['/assets/app.js'])),'/assets/app.js');
  assert.equal(route('/assets/missing.js'),null);
  assert.equal(route('/missing.css'),null);
  assert.equal(route('/owner/readiness','POST'),null);
  for(const p of ['/api/unknown','/api/','/Api/unknown'])assert.ok(route(p).startsWith(origin+'/api/'));
});
function fixture(run) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'frontend-artifact-'));
  try {fs.mkdirSync(path.join(root,'assets')); fs.writeFileSync(path.join(root,'index.html'),'<html></html>');run(root);}
  finally {fs.rmSync(root,{recursive:true,force:true});}
}
test('output allows multiple chunks and rejects backend/secret/env/map artifacts',()=>{
  fixture(root=>{for(const f of ['app.js','vendor.js','app.css'])fs.writeFileSync(path.join(root,'assets',f),'');assert.equal(auditFrontend(root),4);});
  for(const file of ['server.cjs','.env.production','schema.sql','package.json','assets/app.js.map','assets/server.js','api/handler.js','assets/key.pem'])fixture(root=>{
    fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),'');assert.throws(()=>auditFrontend(root));
  });
});
test('output rejects symlinks, missing index and sensitive JS without echoing values',()=>{
  fixture(root=>{fs.symlinkSync('index.html',path.join(root,'alias'));assert.throws(()=>auditFrontend(root));});
  fixture(root=>{fs.unlinkSync(path.join(root,'index.html'));assert.throws(()=>auditFrontend(root));});
  fixture(root=>{
    const marker='postgres'+'ql://fixture:synthetic-password@db.invalid/example';
    fs.writeFileSync(path.join(root,'assets','app.js'),marker);
    assert.throws(()=>auditFrontend(root),{message:'FRONTEND_SENSITIVE_CONTENT'});
  });
  const cli=spawnSync(process.execPath,[path.resolve('scripts/verify-vercel-output.mjs')],{cwd:os.tmpdir(),encoding:'utf8'});
  assert.equal(cli.status,1);assert.match(cli.stderr,/FAIL: Frontend artifact audit rejected output/);
});
test('browser environment rejects private keys and unexpected public-prefixed settings',()=>{
  for(const key of ['VITE_DATABASE_URL','VITE_OWNER_API_KEY','VITE_FINANCIAL_EXECUTION_ALLOWED','VITE_UNKNOWN'])
    assert.throws(()=>validateBrowserEnvironment({[key]:'fixture'}),{message:'FRONTEND_ENVIRONMENT_REJECTED'});
  validateBrowserEnvironment({VITE_SUPABASE_URL:'https://public.example',VITE_SUPABASE_ANON_KEY:'sb_publishable_'+'x'.repeat(20)});
  const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url'),'fixture'].join('.');
  assert.equal(sensitiveContent(token),true);
  assert.throws(()=>validateBrowserEnvironment({VITE_SUPABASE_ANON_KEY:token}));
  assert.throws(()=>validateBrowserEnvironment({VITE_SUPABASE_ANON_KEY:'opaque-private-fixture'}));
  assert.throws(()=>validateBrowserEnvironment({VITE_SUPABASE_URL:'https://fixture:fixture@public.example'}));
  assert.equal(sensitiveContent('sb_'+'secret_'+'x'.repeat(24)),true);
  assert.equal(sensitiveContent('dev_'+'auto=true'),true);
});
test('browser module graph rejects backend and Node-only dependencies',()=>{
  for(const id of ['/repo/server.ts','/repo/server/pgDatabase.ts','/repo/scripts/migrateDatabase.ts','/repo/node_modules/pg/lib/index.js','/repo/node_modules/dotenv/lib/main.js','node:fs','__vite-browser-external'])assert.equal(backendModule(id),true);
  for(const id of ['/repo/src/App.tsx','/repo/src/services/cryptoEngine.ts','/repo/node_modules/react/index.js','/repo/node_modules/lucide-react/dist/esm/icons/server.js'])assert.equal(backendModule(id),false);
});
test('production cookie contract is host-only, HttpOnly, Secure and strict; frontend uses same-origin',()=>{
  const server=fs.readFileSync('server.ts','utf8');
  const login=server.slice(server.indexOf("app.post('/api/auth/login'"),server.indexOf('// Logout Endpoint'));
  assert.match(login,/authenticateAndCreateSession/);
  assert.match(login,/httpOnly: true/);assert.match(login,/secure: process.env.NODE_ENV === 'production'/);assert.match(login,/sameSite: 'strict'/);
  assert.doesNotMatch(login,/domain\s*:/i);
  const app=fs.readFileSync('src/App.tsx','utf8');
  assert.match(app,/credentials: 'same-origin'/);assert.doesNotMatch(app,/localStorage/);
});

test('every frontend fetch target is same-origin API or one of the two reviewed local expressions',()=>{
  const files=[];
  function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.tsx?$/.test(f))files.push(f);}}
  walk('src');
  let seen=0;
  for(const f of files){
    const source=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true);
    function visit(n){
      if(ts.isCallExpression(n) && ['fetch','safeFetchJson'].includes(n.expression.getText(source))){
        const target=n.arguments[0];assert.ok(target);seen++;
        if(ts.isBinaryExpression(target) && target.operatorToken.kind===ts.SyntaxKind.PlusToken) {
          let prefix=target.left;
          while(ts.isBinaryExpression(prefix) && prefix.operatorToken.kind===ts.SyntaxKind.PlusToken)prefix=prefix.left;
          assert.ok(ts.isStringLiteralLike(prefix) && prefix.text.startsWith('/api/'));
        }
        else if(ts.isStringLiteralLike(target))assert.ok(target.text.startsWith('/api/'));
        else if(ts.isTemplateExpression(target))assert.ok(target.head.text.startsWith('/api/'));
        else {
          assert.ok((f.replaceAll('\\','/').endsWith('/LiveGpuPriceRouter.tsx') && target.getText(source)==='url') ||
            (f.replaceAll('\\','/').endsWith('/ArbitrageContext.tsx') && target.getText(source)==='sessionEndpoint'));
        }
      }
      ts.forEachChild(n,visit);
    }
    visit(source);
  }
  assert.ok(seen>80);
});
