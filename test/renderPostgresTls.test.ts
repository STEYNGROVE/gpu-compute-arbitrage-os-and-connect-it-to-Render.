import assert from 'node:assert/strict';
import { test } from 'node:test';
import pg from 'pg';
import net from 'node:net';
import { secureDatabaseOptions } from '../server/phase21/configuration.js';

const url = (host: string) =>
  `postgresql://user:password@${host}:5432/db`;

const env = {
  NODE_ENV: 'production',
  RENDER_SERVICE_ID: 'srv-example',
  DATABASE_INTERNAL_TRANSPORT: 'render-private-network',
  RENDER_INTERNAL_DB_HOST: 'dpg-example-a'
};

const options = (
  host: string,
  extra: Record<string, string> = {}
) => secureDatabaseOptions(
  url(host),
  { ...env, ...extra },
  () => { throw Error('Unexpected CA read'); }
);

test('private-network assertions alone still require authenticated TLS', () => {
  assert.deepEqual(
    options('dpg-example-a').ssl,
    { rejectUnauthorized: true }
  );
});

test('external PostgreSQL requires verified TLS', () => {
  assert.deepEqual(
    options('database.example.com').ssl,
    { rejectUnauthorized: true }
  );
});

test('unknown internal-style host must not bypass TLS', () => {
  assert.deepEqual(
    options('dpg-untrusted-a').ssl,
    { rejectUnauthorized: true }
  );
});

test('non-Render environment requires TLS', () => {
  const result = secureDatabaseOptions(
    url('dpg-example-a'),
    { NODE_ENV: 'production' },
    () => ''
  );
  assert.deepEqual(result.ssl, { rejectUnauthorized: true });
});

test('insecure TLS override is rejected', () => {
  assert.throws(
    () => options('database.example.com', {
      DATABASE_SSL_REJECT_UNAUTHORIZED: 'false'
    }),
    /DATABASE_TLS_REQUIRED/
  );
});


test('trusted hostname alone does not opt into plaintext',()=>{
  assert.deepEqual(options('dpg-example-a',{DATABASE_INTERNAL_TRANSPORT:''}).ssl,{rejectUnauthorized:true});
});
test('missing trusted hostname does not opt into plaintext',()=>{
  assert.deepEqual(options('dpg-example-a',{RENDER_INTERNAL_DB_HOST:''}).ssl,{rejectUnauthorized:true});
});
test('explicit secure TLS settings take precedence over private policy',()=>{
  for(const query of ['sslmode=require','sslmode=verify-full','ssl=true','ssl=1']) {
    assert.deepEqual(secureDatabaseOptions(url('dpg-example-a')+'?'+query,env,()=> '').ssl,{rejectUnauthorized:true});
  }
  assert.deepEqual(options('dpg-example-a',{DATABASE_SSL:'true'}).ssl,{rejectUnauthorized:true});
});
test('CA settings are preserved and driver TLS parameters removed',()=>{
  const result=secureDatabaseOptions(url('dpg-example-a')+'?sslrootcert=fixture-ca&sslmode=verify-full',env,p=>{assert.equal(p,'fixture-ca');return 'CA';});
  assert.deepEqual(result.ssl,{rejectUnauthorized:true,ca:'CA'});
  assert.equal(new URL(result.connectionString).search,'');
  assert.throws(()=>secureDatabaseOptions(url('db.example')+'?sslrootcert=a',{...env,DATABASE_SSL_CA:'b'},()=>''),/DATABASE_CA_CONFLICT/);
  assert.throws(()=>secureDatabaseOptions(url('db.example'),{...env,DATABASE_SSL_CA:'a'},()=>{throw Error('secret-path');}),/^Error: DATABASE_CA_UNAVAILABLE$/);
});
test('malformed URLs produce secret-safe errors',()=>{
  for(const raw of ['postgresql://secret@','postgresql:///db','https://user:password@host/db','postgresql://user:password@host/db#secret','postgresql://user:%zz@host/db']) {
    assert.throws(()=>secureDatabaseOptions(raw,env,()=>''),e=>e instanceof Error && /^INVALID_DATABASE_(URL|PROTOCOL)$/.test(e.message));
  }
});
test('driver overrides cannot redirect host, disable timeouts or weaken TLS',()=>{
  for(const query of ['host=evil.example','port=6543','connectionTimeoutMillis=0','query_timeout=0','statement_timeout=0','options=-cstatement_timeout%3D0','sslmode=require&sslmode=disable','sslmode=prefer','ssl=false','ssl=0','sslcert=secret','sslkey=secret','uselibpqcompat=true','sslnegotiation=direct']) {
    assert.throws(()=>secureDatabaseOptions(url('dpg-example-a')+'?'+query,env,()=>''));
  }
});
test('global TLS bypass fails closed',()=>{
  assert.throws(()=>options('db.example', {NODE_TLS_REJECT_UNAUTHORIZED:'0'}),/DATABASE_TLS_REQUIRED/);
});
test('remote nonproduction connections also require authenticated TLS',()=>{
  assert.deepEqual(options('db.example',{NODE_ENV:'test'}).ssl,{rejectUnauthorized:true});
  assert.equal(options('127.0.0.1',{NODE_ENV:'test'}).ssl,false);
});
test('hostname variations and nonstandard port do not grant plaintext',()=>{
  for(const host of ['DPG-example-a','dpg-example-a.','dpg-example-a.evil.test'])assert.deepEqual(options(host).ssl,{rejectUnauthorized:true});
  assert.deepEqual(secureDatabaseOptions(url('dpg-example-a').replace(':5432',':6543'),env,()=> '').ssl,{rejectUnauthorized:true});
});
test('connection and query limits are bounded',()=>{
  const result=options('db.example');
  assert.equal(result.connectionTimeoutMillis,5000);assert.equal(result.query_timeout,5000);assert.equal(result.statement_timeout,5000);
});

test('installed pg driver receives verified TLS and fixed timeouts',()=>{
  const config=secureDatabaseOptions(url('external.example')+'?sslmode=require&sslrootcert=ca',env,()=> 'fixture-ca');
  const client=new pg.Client(config);
  const params=(client as unknown as {connectionParameters:{ssl:unknown;host:string;query_timeout:number;statement_timeout:number}}).connectionParameters;
  assert.deepEqual(params.ssl,{rejectUnauthorized:true,ca:'fixture-ca'});assert.equal(params.host,'external.example');
  assert.equal(params.query_timeout,5000);assert.equal(params.statement_timeout,5000);
});
test('private policy cannot weaken pg SSL defaults',()=>{
  const result=options('dpg-example-a');
  const client=new pg.Client(result);
  assert.deepEqual((client as unknown as {connectionParameters:{ssl:unknown}}).connectionParameters.ssl,{rejectUnauthorized:true});
});

test('connection timeout closes an unresponsive local PostgreSQL handshake',async()=>{
  const sockets=new Set<net.Socket>();
  const server=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const address=server.address();assert(address&&typeof address!=='string');
  const client=new pg.Client(secureDatabaseOptions(url('127.0.0.1').replace(':5432',':'+address.port),{NODE_ENV:'test'},()=>''));
  try {
    const start=Date.now();await assert.rejects(client.connect());
    assert.ok(Date.now()-start<15000,'five-second connection deadline must terminate a stalled handshake');
  } finally {await client.end();for(const socket of sockets)socket.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
