import assert from 'node:assert/strict';
import {test} from 'node:test';
import express from 'express';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {registerProductionStatic} from '../server/phase21/staticAssets.js';

test('production serves frontend assets and SPA routes but never backend artifacts',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'phase22-static-'));
  const privateMarker='PRIVATE_BACKEND_FIXTURE';
  mkdirSync(path.join(root,'assets'));
  for(const file of ['server.cjs','server.cjs.map','other-backend.js','assets/server.cjs','assets/index.js.map'])writeFileSync(path.join(root,file),privateMarker);
  writeFileSync(path.join(root,'index.html'),'<html>FRONTEND_FIXTURE</html>');
  writeFileSync(path.join(root,'assets','index.js'),'FRONTEND_JS_FIXTURE');
  const app=express();registerProductionStatic(app,root);
  const server=app.listen(0,'127.0.0.1');
  try {
    await new Promise<void>(resolve=>server.listening?resolve():server.once('listening',resolve));
    const address=server.address();assert(address&&typeof address!=='string');
    const base='http://127.0.0.1:'+address.port;
    for(const target of ['/server.cjs','/server.cjs.map','/%73erver.cjs','/server%2Ecjs','/server.cjs?download=1','/assets/server.cjs','/assets/index.js.map','/assets/%2e%2e/server.cjs','/SERVER.CJS']){
      const response=await fetch(base+target);assert.equal(response.status,404,target);assert.ok(!(await response.text()).includes(privateMarker));
    }
    assert.equal((await fetch(base+'/server.cjs',{headers:{Range:'bytes=0-4095'}})).status,404);
    const unknown=await fetch(base+'/other-backend.js');assert.ok(!(await unknown.text()).includes(privateMarker));
    for(const target of ['/','/index.html','/dashboard']){const response=await fetch(base+target);assert.equal(response.status,200);assert.match(await response.text(),/FRONTEND_FIXTURE/);}
    const asset=await fetch(base+'/assets/index.js');assert.equal(asset.status,200);assert.equal(await asset.text(),'FRONTEND_JS_FIXTURE');
    const api=await fetch(base+'/api/missing');assert.equal(api.status,404);assert.equal((await api.json()).error,'API_ROUTE_NOT_FOUND');
    assert.equal((await fetch(base+'/%zz')).status,400);
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(root,{recursive:true,force:true});}
});

test('baseline broad static middleware exposes a co-located backend artifact',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'phase22-baseline-static-'));
  writeFileSync(path.join(root,'server.cjs'),'BACKEND_FIXTURE');
  const app=express();app.use(express.static(root));const server=app.listen(0,'127.0.0.1');
  try {
    await new Promise<void>(resolve=>server.listening?resolve():server.once('listening',resolve));
    const address=server.address();assert(address&&typeof address!=='string');
    const response=await fetch('http://127.0.0.1:'+address.port+'/server.cjs');
    assert.equal(response.status,200);assert.equal(await response.text(),'BACKEND_FIXTURE');
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(root,{recursive:true,force:true});}
});
