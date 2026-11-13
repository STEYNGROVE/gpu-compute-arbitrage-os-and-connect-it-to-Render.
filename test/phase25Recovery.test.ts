import {commercialColumnTypes} from '../server/commercialSchema.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadMigrationEnvironment} from '../scripts/migrationEnvironment.js';
import {PostgresDatabaseService} from '../server/pgDatabase.js';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type pg from 'pg';

const fixtureUrl=new URL('postgresql://fixture@database.example/db');fixtureUrl.password='synthetic-password';

test('migration configuration loads only explicit development before authorization',()=>{
  for(const mode of ['production','test',undefined,'development']){
    const env:NodeJS.ProcessEnv={NODE_ENV:mode};let calls=0;
    loadMigrationEnvironment(env,()=>{calls++;env.DB_MIGRATION_EXECUTE='EXPLICITLY_AUTHORIZED';return {} as any;});
    assert.equal(calls,mode==='development'?1:0);
    assert.equal(env.DB_MIGRATION_EXECUTE,mode==='development'?'EXPLICITLY_AUTHORIZED':undefined);
  }
});
const files=readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort();
const history=files.map(file=>({version:file.slice(0,-4),checksum:createHash('sha256').update(readFileSync('supabase/migrations/'+file,'utf8').trim()).digest('hex')}));
test('commercial prerequisite precedes all referencing migrations',()=>{
  const prerequisite=files.find(x=>x.includes('commercial_intake_prerequisites'))!;
  assert(prerequisite);assert(files.indexOf(prerequisite)<files.indexOf('20261110_v5_commercial_evidence.sql'));
  const source=readFileSync('supabase/migrations/'+prerequisite,'utf8');
  for(const table of ['commercial_quote_requests','customer_intelligence_leads','gpu_hunter_opportunities','preapproved_workload_evidence'])assert(source.includes('CREATE TABLE IF NOT EXISTS '+table));
});
for(const fault of ['missing table','missing column','wrong column type','missing migration','changed migration','unknown migration','duplicate migration'])test('schema readiness rejects '+fault,async()=>{
  const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';
  const service=new PostgresDatabaseService(()=>{throw Error('NO_REAL_POOL');});
  const client={query:async(sql:string,params?:string[][])=>{
    if(sql.includes('information_schema.tables'))return {rows:params![0].filter(t=>fault!=='missing table'||t!=='commercial_quote_requests').map(table_name=>({table_name}))};
    if(sql.includes('information_schema.columns'))return {rows:Object.entries(commercialColumnTypes).flatMap(([table_name,columns])=>Object.entries(columns).map(([column_name,data_type])=>({table_name,column_name,data_type:fault==='wrong column type'?'text':data_type})))};
    if(sql==='SELECT version, checksum FROM schema_migrations')return {rows:fault==='missing migration'?history.slice(1):fault==='changed migration'?history.map((r,i)=>i===0?{...r,checksum:'0'.repeat(64)}:r):fault==='unknown migration'?[...history,{version:'unreviewed_fixture',checksum:'0'.repeat(64)}]:fault==='duplicate migration'?[...history,history[0]]:history};
    if(fault==='missing column'&&sql.includes('FROM preapproved_workload_evidence'))throw Object.assign(Error('missing column'),{code:'42703'});
    return {rows:[]};
  }} as unknown as pg.PoolClient;
  try{await assert.rejects(service.verifySchemaReadiness(client));assert.equal(service.getStatus().liveExecutionAllowed,false);}
  finally{await service.close();if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});

test('test execution cannot target a remote database even with authorization markers',async()=>{
 const {spawnSync}=await import('node:child_process');
 const result=spawnSync(process.execPath,['--import','tsx','scripts/migrateDatabase.ts'],{encoding:'utf8',env:{...process.env,NODE_ENV:'test',DATABASE_URL:fixtureUrl.href,DB_MIGRATION_EXECUTE:'EXPLICITLY_AUTHORIZED',DB_MIGRATION_TARGET:'fixture',DB_MIGRATION_TARGET_CONFIRM:'fixture'}});
 assert.equal(result.status,1);assert.match(result.stderr,/MIGRATION_BLOCKED/);assert(!result.stderr.includes('database.example'));
});

test('standalone CLI loads development dotenv before the gate and ignores it otherwise',async()=>{
 const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');const path=await import('node:path');const {spawnSync}=await import('node:child_process');
 const root=mkdtempSync(path.join(tmpdir(),'phase25-env-'));const script=path.resolve('scripts/migrateDatabase.ts');
 try {
  mkdirSync(path.join(root,'supabase','migrations'),{recursive:true});writeFileSync(path.join(root,'supabase','migrations','fixture.sql'),'SELECT 1;');
  // Authorization is intentionally incomplete: this must never open a database.
  writeFileSync(path.join(root,'.env'),'DB_MIGRATION_EXECUTE=EXPLICITLY_AUTHORIZED\n');
  for(const mode of ['development','production','test']){
   const env:NodeJS.ProcessEnv={...process.env,NODE_ENV:mode};for(const key of Object.keys(env))if(key.startsWith('DB_MIGRATION_')||['DATABASE_URL','DIRECT_URL','SUPABASE_DB_URL','POSTGRES_URL'].includes(key))delete env[key];
   const result=spawnSync(process.execPath,['--import',import.meta.resolve('tsx'),script],{cwd:root,env,encoding:'utf8'});
   assert.equal(result.status,mode==='development'?1:0);
   if(mode==='development')assert.match(result.stderr,/MIGRATION_BLOCKED/);else assert.match(result.stdout,/VALIDATION ONLY/);
  }
 } finally {rmSync(root,{recursive:true,force:true});}
});

for(const [table,column] of [['commercial_verification','state'],['commercial_quote_evidence','customer_rate_usd_per_gpu_hour'],['commercial_evidence_audit','after_data']])test('commercial readiness rejects missing v5 column '+table+'.'+column,async()=>{
 const {verifyCommercialColumnTypes}=await import('../server/commercialSchema.js');
 const rows=Object.entries(commercialColumnTypes).flatMap(([table_name,columns])=>Object.entries(columns).filter(([column_name])=>table_name!==table||column_name!==column).map(([column_name,data_type])=>({table_name,column_name,data_type})));
 await assert.rejects(verifyCommercialColumnTypes({query:async()=>({rows})} as unknown as pg.PoolClient),/COMMERCIAL_SCHEMA_INCOMPATIBLE/);
});

test('migration verification rejects an empty source directory before querying history',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=mkdtempSync(join(tmpdir(),'phase25-empty-'));let queries=0;
 try {await assert.rejects(PostgresDatabaseService.prototype.verifyMigrationChecksums.call({} as PostgresDatabaseService,{query:async()=>{queries++;return {rows:[]};}} as unknown as pg.PoolClient,dir),/MIGRATION_INTEGRITY_FAILURE/);assert.equal(queries,0);}
 finally {rmSync(dir,{recursive:true,force:true});}
});
