import {commercialColumnTypes} from '../server/commercialSchema.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import { PostgresDatabaseService,pgDbService } from '../server/pgDatabase.js';
import { startDiscoveryServices } from '../server/phase21/startup.js';

const fixtureDatabaseUrl=()=>{
  const url=new URL('postgresql://fixture@primary.example/db');
  url.password='synthetic-password';
  return url.href;
};

// No socket or provider is opened; preserve the caller's environment after each fixture.
async function fixture(run:(s:PostgresDatabaseService,pools:FakePool[])=>Promise<void>,direct?:string) {
  const keys=['DATABASE_URL','DIRECT_URL','SUPABASE_DB_URL','POSTGRES_URL','NODE_ENV','DATABASE_SSL_CA','DATABASE_SSL_REJECT_UNAUTHORIZED','NODE_TLS_REJECT_UNAUTHORIZED'];
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  keys.forEach(k=>delete process.env[k]);
  process.env.NODE_ENV='production';process.env.DATABASE_URL=fixtureDatabaseUrl();
  if(direct)process.env.DIRECT_URL=direct;
  const pools:FakePool[]=[];
  const service=new PostgresDatabaseService(config=>{const pool=new FakePool(config);pools.push(pool);return pool as unknown as pg.Pool;});
  // Isolate lifecycle from schema contents; separately assert runtime schema checks use SELECTs.
  service.verifySchemaReadiness=async()=>{};
  try {await run(service,pools);} finally {await service.close();for(const k of keys){if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}}
}
class FakePool extends EventEmitter {
  ended=0;released=0;fail=false;queries:string[]=[];
  constructor(readonly config:pg.PoolConfig){super();}
  async connect(){if(this.fail)throw Object.assign(Error('secret-url'),{code:'ECONNREFUSED'});return {query:async(sql:string)=>{this.queries.push(sql);return {rows:[]};},release:()=>{this.released++;}};}
  async end(){this.ended++;}
}
test('initialization and readiness are read-only and financial execution stays disabled',()=>fixture(async(s,p)=>{
  assert.equal((await s.initialize()).success,true);
  assert.equal(s.getStatus().liveExecutionAllowed,false);
  assert.equal(await s.probeReadiness(),true);
  assert.ok(p[0].queries.every(q=>/^SELECT /i.test(q)));assert.equal(p[0].released,2);
}));
test('pool errors fail closed and readiness recovers',()=>fixture(async(s,p)=>{
  await s.initialize();p[0].emit('error',Object.assign(Error('secret-url'),{code:'ECONNRESET'}));
  assert.equal(s.isLiveDatabaseConnected(),false);assert.equal(s.assertLiveModeAllowed().allowed,false);
  assert.equal(await s.probeReadiness(),true);assert.equal(s.isLiveDatabaseConnected(),true);
}));
test('schema failure never advertises a ready database and releases client',()=>fixture(async(s,p)=>{
  s.verifySchemaReadiness=async()=>{throw Error('schema missing');};
  assert.equal((await s.initialize()).success,false);assert.equal(s.isLiveDatabaseConnected(),false);assert.equal(p[0].released,1);
  assert.equal(await s.probeReadiness(),false);assert.equal(p[0].released,2);
}));
test('DIRECT_URL uses the same verified TLS policy and drains the primary pool',()=>fixture(async(s,p)=>{
  p[0].fail=true;
  assert.equal((await s.initialize()).success,true);assert.equal(p.length,2);assert.equal(p[0].ended,1);
  assert.deepEqual(p[1].config.ssl,{rejectUnauthorized:true});assert.equal(p[1].config.query_timeout,5000);
},'postgresql://fixture:fixture@fallback.example/db?sslmode=verify-full'));
test('invalid fallback cannot silently reuse the primary pool',()=>fixture(async(s,p)=>{
  p[0].fail=true;assert.equal((await s.initialize()).success,false);
  assert.equal(p.length,1);assert.equal(p[0].ended,1);assert.equal(await s.probeReadiness(),false);
},'postgresql://fixture:fixture@fallback.example/db?sslmode=disable'));
test('close drains pool exactly once and readiness stays unavailable',()=>fixture(async(s,p)=>{
  await s.initialize();await s.close();await s.close();assert.equal(p[0].ended,1);
  assert.equal(await s.probeReadiness(),false);await assert.rejects(s.query('SELECT 1'),/DATABASE_UNAVAILABLE/);
}));
test('discovery bootstrap failure never initializes directory or exposes financial capabilities',async()=>{
  let directory=0;
  const result=await startDiscoveryServices({initializeDatabase:async()=>({success:false,mode:'POSTGRES_DISCONNECTED'}),initializeDirectory:async()=>{directory++;}});
  assert.equal(result.success,false);assert.equal(result.liveReady,false);assert.equal(result.treasuryStatus,'DISABLED');assert.equal(directory,0);
});
// Singleton construction is lazy (pg Pool does not connect until used).
test.after(async()=>{await pgDbService.close();});

test('production cannot bypass schema verification with skipSchemaCheck',()=>fixture(async(s)=>{
  s.verifySchemaReadiness=async()=>{throw Error('schema missing');};
  assert.equal((await s.initialize({skipSchemaCheck:true})).success,false);
}));
test('stale pool errors do not invalidate a replacement pool',()=>fixture(async(s,p)=>{
  p[0].fail=true;await s.initialize();
  p[0].emit('error',Error('retired pool'));assert.equal(s.isLiveDatabaseConnected(),true);
},'postgresql://fixture:fixture@fallback.example/db'));
test('readiness finishing during close cannot restore connected state',()=>fixture(async(s,p)=>{
  let enter!:()=>void,finish!:()=>void;
  const entered=new Promise<void>(r=>enter=r);const blocked=new Promise<void>(r=>finish=r);
  s.verifySchemaReadiness=async()=>{enter();await blocked;};
  const probe=s.probeReadiness();await entered;await s.close();finish();
  assert.equal(await probe,false);assert.equal(s.isLiveDatabaseConnected(),false);assert.equal(p[0].released,1);
}));

test('initialization finishing during close does not reopen fallback',()=>fixture(async(s,p)=>{
  let enter!:()=>void,finish!:()=>void;
  const entered=new Promise<void>(r=>enter=r);const blocked=new Promise<void>(r=>finish=r);
  s.verifySchemaReadiness=async()=>{enter();await blocked;};
  const init=s.initialize();await entered;await s.close();finish();
  assert.equal((await init).success,false);assert.equal(p.length,1);assert.equal(s.isLiveDatabaseConnected(),false);
},'postgresql://fixture:fixture@fallback.example/db'));

test('shutdown during failover drain cannot reopen a pool',()=>fixture(async(s,p)=>{
  let enter!:()=>void,finish!:()=>void;
  const entered=new Promise<void>(r=>enter=r);const blocked=new Promise<void>(r=>finish=r);
  p[0].fail=true;p[0].end=async()=>{p[0].ended++;enter();await blocked;};
  const init=s.initialize();await entered;const closing=s.close();finish();await closing;
  assert.equal((await init).success,false);assert.equal(p.length,1);assert.equal(s.isLiveDatabaseConnected(),false);
},'postgresql://fixture:fixture@fallback.example/db'));

test('fallback cannot substitute the trusted URL authority with a driver host parameter',()=>fixture(async(s,p)=>{
  p[0].fail=true;assert.equal((await s.initialize()).success,false);
  assert.equal(p.length,1);assert.equal(p[0].ended,1);assert.equal(s.getStatus().liveExecutionAllowed,false);
},'postgresql://fixture:fixture@fallback.example/db?host=other.example'));
test('actual production schema verifier performs SELECTs only and verifies local checksums',()=>fixture(async(s)=>{
  const sqls:string[]=[];
  const client={query:async(sql:string,params?:string[][])=>{
    sqls.push(sql);assert.match(sql,/^SELECT /);
    if(sql.includes('information_schema.tables'))return {rows:params![0].map(table_name=>({table_name}))};
    if(sql.includes('information_schema.columns'))return {rows:Object.entries(commercialColumnTypes).flatMap(([table_name,columns])=>Object.entries(columns).map(([column_name,data_type])=>({table_name,column_name,data_type})))};
    if(sql==='SELECT version, checksum FROM schema_migrations')return {rows:fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).map(file=>({version:file.slice(0,-4),checksum:createHash('sha256').update(fs.readFileSync(path.join('supabase/migrations',file),'utf8').trim()).digest('hex')}))};
    return {rows:[]};
  }} as unknown as pg.PoolClient;
  await PostgresDatabaseService.prototype.verifySchemaReadiness.call(s,client);
  assert.equal(sqls.length,8);assert.ok(sqls.some(sql=>sql.includes('schema_migrations')));assert.ok(sqls.some(sql=>sql.includes('acquisition_leads')));
}));

function barrier() {
  let release!:()=>void;
  const wait=new Promise<void>(r=>release=r);
  return {wait,release};
}
test('concurrent initialization shares a single connection attempt',()=>fixture(async(s,p)=>{
  const gate=barrier();let calls=0;
  s.verifySchemaReadiness=async()=>{calls++;await gate.wait;};
  const a=s.initialize(),b=s.initialize();assert.equal(a,b);
  gate.release();assert((await a).success);assert((await b).success);assert.equal(calls,1);assert.equal(p[0].released,1);
}));
test('concurrent probes coalesce and a pool error invalidates an in-flight success',()=>fixture(async(s,p)=>{
  await s.initialize();const gate=barrier(),entered=barrier();
  s.verifySchemaReadiness=async()=>{entered.release();await gate.wait;};
  const a=s.probeReadiness(),b=s.probeReadiness();assert.equal(a,b);await entered.wait;
  p[0].emit('error',Object.assign(Error('private'),{code:'ECONNRESET'}));gate.release();
  assert.equal(await a,false);assert.equal(await b,false);assert.equal(s.isLiveDatabaseConnected(),false);
  assert.equal(p[0].released,2);
}));
test('old probe cannot overwrite a replacement pool after fallback',()=>fixture(async(s,p)=>{
  const gate=barrier(),entered=barrier();let checks=0;
  s.verifySchemaReadiness=async()=>{if(++checks===1){entered.release();await gate.wait;throw Error('old schema');}};
  const probe=s.probeReadiness();await entered.wait;p[0].fail=true;
  assert.equal((await s.initialize()).success,true);gate.release();assert.equal(await probe,false);
  assert.equal(s.isLiveDatabaseConnected(),true);assert.equal(p[0].ended,1);
},'postgresql://fixture:fixture@fallback.example/db'));
test('failed fallback releases its client and remains disconnected',()=>fixture(async(s,p)=>{
  p[0].fail=true;s.verifySchemaReadiness=async()=>{throw Error('missing schema');};
  assert.equal((await s.initialize()).success,false);assert.equal(s.isLiveDatabaseConnected(),false);
  assert.equal(p[1].released,1);await s.close();assert.deepEqual(p.map(x=>x.ended),[1,1]);
},'postgresql://fixture:fixture@fallback.example/db'));
test('stale fallback completion cannot disconnect a new initialization',()=>fixture(async(s,p)=>{
  p[0].fail=true;const entered=barrier(),gate=barrier();let calls=0;
  s.verifySchemaReadiness=async()=>{if(++calls===1){entered.release();await gate.wait;throw Error('old schema');}};
  const old=s.initialize();await entered.wait;await s.close();
  assert.equal((await s.initialize()).success,true);gate.release();assert.equal((await old).success,false);
  assert.equal(s.isLiveDatabaseConnected(),true);await s.close();assert.deepEqual(p.map(x=>x.ended),[1,1,1]);
},'postgresql://fixture:fixture@fallback.example/db'));
test('cleanup rejection is observed and repeated close shares the failure',()=>fixture(async(s,p)=>{
  p[0].end=async()=>{p[0].ended++;throw Error('private drain failure');};
  const a=s.close(),b=s.close();assert.equal(a,b);await assert.rejects(a,/private drain failure/);
  assert.equal(p[0].ended,1);assert.equal((await s.initialize()).success,false);
  // Fixture teardown must explicitly observe the same failed shutdown.
  s.close=async()=>{await a.catch(()=>{});};
}));
test('repeated initialization reuses pool and initialization invalidates earlier probe',()=>fixture(async(s,p)=>{
  for(let i=0;i<5;i++)assert.equal((await s.initialize()).success,true);
  assert.equal(p.length,1);assert.equal(p[0].released,5);
}));
test('query failure releases each acquired client',()=>fixture(async(s,p)=>{
  p[0].connect=async()=>({query:async()=>{throw Error('query failed');},release:()=>{p[0].released++;}});
  assert.equal((await s.initialize()).success,false);assert.equal(await s.probeReadiness(),false);assert.equal(p[0].released,2);
}));
test('client acquisition during shutdown releases the superseded client',()=>fixture(async(s,p)=>{
  await s.initialize();const gate=barrier(),entered=barrier();const connect=p[0].connect.bind(p[0]);
  p[0].connect=async()=>{entered.release();await gate.wait;return connect();};
  const acquisition=s.getClient();await entered.wait;await s.close();gate.release();
  await assert.rejects(acquisition,/DATABASE_UNAVAILABLE/);assert.equal(p[0].released,2);
}));
test('failed retirement blocks additional pools instead of leaking replacements',()=>fixture(async(s,p)=>{
  p[0].fail=true;p[0].end=async()=>{p[0].ended++;throw Error('drain failed');};
  assert.equal((await s.initialize()).success,false);assert.equal((await s.initialize()).success,false);
  assert.equal(p.length,1);assert.equal(p[0].ended,1);
  await assert.rejects(s.close(),/drain failed/);s.close=async()=>{};
},'postgresql://fixture:fixture@fallback.example/db'));
test('primary connection failure stays disconnected without acquiring a client',()=>fixture(async(s,p)=>{
  p[0].fail=true;assert.equal((await s.initialize()).success,false);
  assert.equal(s.isLiveDatabaseConnected(),false);assert.equal(p[0].released,0);
  assert.equal(p.length,1);assert.equal(s.getStatus().liveExecutionAllowed,false);
}));
test('shutdown while connect is pending cannot publish success or open fallback',()=>fixture(async(s,p)=>{
  const entered=barrier(),gate=barrier(),connect=p[0].connect.bind(p[0]);
  p[0].connect=async()=>{entered.release();await gate.wait;return connect();};
  const init=s.initialize();await entered.wait;const closing=s.close();gate.release();await closing;
  assert.equal((await init).success,false);assert.equal(p[0].released,1);assert.equal(p.length,1);
},'postgresql://fixture:fixture@fallback.example/db'));
test('programming defects propagate while clients are still released',()=>fixture(async(s,p)=>{
  await s.initialize();
  s.verifySchemaReadiness=async()=>{throw new TypeError('fixture programming defect');};
  await assert.rejects(s.probeReadiness(),TypeError);assert.equal(s.isLiveDatabaseConnected(),false);
  await assert.rejects(s.initialize(),TypeError);
  assert.equal(p[0].released,3);assert.equal(s.isLiveDatabaseConnected(),false);
}));
