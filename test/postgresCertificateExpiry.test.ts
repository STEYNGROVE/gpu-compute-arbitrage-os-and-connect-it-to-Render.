import {test} from 'node:test';
import assert from 'node:assert/strict';
import tls from 'node:tls';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {secureDatabaseOptions} from '../server/phase21/configuration.js';

test('production TLS options reject an expired trusted certificate',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'phase25-expired-'));
 const file=(s:string)=>path.join(dir,s);
 function openssl(args:string[]){const result=spawnSync('openssl',args,{encoding:'utf8'});assert.ifError(result.error);assert.equal(result.status,0,'isolated certificate generation failed');}
 try {
  openssl(['req','-new','-newkey','rsa:2048','-nodes','-keyout',file('key'),'-out',file('request'),'-subj','/CN=localhost']);
  openssl(['req','-x509','-key',file('key'),'-out',file('issuer'),'-days','1','-subj','/CN=localhost']);
  writeFileSync(file('index'),'');writeFileSync(file('serial'),'01');
  writeFileSync(file('config'),`[ca]\ndefault_ca=fixture\n[fixture]\ndatabase=${file('index')}\nserial=${file('serial')}\nnew_certs_dir=${dir}\ndefault_md=sha256\npolicy=policy\n[policy]\ncommonName=supplied\n`);
  openssl(['ca','-batch','-selfsign','-config',file('config'),'-keyfile',file('key'),'-cert',file('issuer'),'-in',file('request'),'-out',file('cert'),'-startdate','20200101000000Z','-enddate','20200102000000Z']);
  const cert=readFileSync(file('cert'),'utf8');
  const server=tls.createServer({key:readFileSync(file('key')),cert},socket=>socket.end());
  server.on('tlsClientError',()=>{});
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const address=server.address();assert(address&&typeof address!=='string');
  try {
   const options=secureDatabaseOptions('postgresql://fixture:fixture@localhost/db',{NODE_ENV:'production',DATABASE_SSL_CA:'fixture'},()=>cert);
   await assert.rejects(new Promise<void>((resolve,reject)=>{
    const socket=tls.connect({...options.ssl as tls.ConnectionOptions,host:'127.0.0.1',port:address.port,servername:'localhost'},()=>{socket.end();resolve();});
    socket.setTimeout(2000,()=>socket.destroy(Error('TLS_TEST_TIMEOUT')));socket.on('error',reject);
   }),(error:any)=>error.code==='CERT_HAS_EXPIRED');
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
 } finally {rmSync(dir,{recursive:true,force:true});}
});

test('production TLS accepts the valid CA and rejects an unrelated CA or wrong hostname',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'phase25-ca-'));const file=(s:string)=>path.join(dir,s);
 function certificate(name:string){const r=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',file(name+'.key'),'-out',file(name+'.crt'),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost'],{encoding:'utf8'});assert.ifError(r.error);assert.equal(r.status,0);}
 try {
  certificate('server');certificate('unrelated');const cert=readFileSync(file('server.crt'),'utf8');
  const server=tls.createServer({key:readFileSync(file('server.key')),cert},s=>s.end());server.on('tlsClientError',()=>{});
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const address=server.address();assert(address&&typeof address!=='string');const port=address.port;
  function connect(ca:string,servername:string){const options=secureDatabaseOptions('postgresql://fixture:fixture@localhost/db',{NODE_ENV:'production',DATABASE_SSL_CA:'fixture'},()=>ca);return new Promise<void>((resolve,reject)=>{
   const socket=tls.connect({...options.ssl as tls.ConnectionOptions,host:'127.0.0.1',port,servername},()=>{socket.end();resolve();});
   socket.setTimeout(2000,()=>socket.destroy(Error('TLS_TEST_TIMEOUT')));socket.on('error',reject);
  });}
  try {
   await connect(cert,'localhost');
   await assert.rejects(connect(readFileSync(file('unrelated.crt'),'utf8'),'localhost'),(e:any)=>/SELF_SIGNED|UNABLE_TO_VERIFY/.test(e.code));
   await assert.rejects(connect(cert,'mismatch.example'),(e:any)=>e.code==='ERR_TLS_CERT_ALTNAME_INVALID');
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
 } finally {rmSync(dir,{recursive:true,force:true});}
});
