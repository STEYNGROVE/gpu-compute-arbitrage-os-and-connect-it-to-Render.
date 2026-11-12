import {EmergencyStopLatch,reviewIndependentBilling} from '../server/phase21/reconciliation.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,generateKeyPairSync,sign} from 'node:crypto';
import {validateProductionConfiguration,secureDatabaseOptions} from '../server/phase21/configuration.js';
import {ServiceLifecycle,gracefulShutdown} from '../server/phase21/lifecycle.js';
import {startDiscoveryServices} from '../server/phase21/startup.js';
import {operationalEvent} from '../server/phase21/observability.js';
import {planMigrations,migrationSource,rollbackAssessment} from '../server/phase21/migrations.js';
import {reviewLaunchEvidence} from '../server/phase21/launchReview.js';
import {EvidenceAuthority,receiptBytes} from '../server/phase20/evidence.js';
import {receipt,now} from './phase20Fixtures.js';
const databaseUrl=()=>{const url=new URL('postgresql://unit-user@database.example.org/test');url.password='synthetic-password';return url.href;};
const config=()=>({NODE_ENV:'production',APP_OPERATING_MODE:'DISCOVERY_ONLY',STRICT_AUTH_ENFORCEMENT:'true',RENDER_GIT_COMMIT:'a'.repeat(40),
  OWNER_API_KEY:randomBytes(32).toString('hex'),CUSTOMER_API_KEY:randomBytes(32).toString('hex'),ESCROW_SIGNING_SECRET:randomBytes(32).toString('hex'),
  QUOTE_LOCK_SECRET:randomBytes(32).toString('hex'),AUDIT_CHAIN_SECRET:randomBytes(32).toString('hex'),DATABASE_URL:databaseUrl()});
test('production profile accepts explicit lockdown without payment or GPU credentials',()=>{const r=validateProductionConfiguration(config());assert(r.valid);assert.equal(r.financialExecutionAllowed,false);});
for(const [key,value] of [['APP_OPERATING_MODE','LIVE'],['STRICT_AUTH_ENFORCEMENT','false'],['NODE_TLS_REJECT_UNAUTHORIZED','0'],['GPU_PURCHASING_ENABLED','true'],['DB_MIGRATION_EXECUTE','EXPLICITLY_AUTHORIZED'],['ENABLE_STUDIO_AUTH_FALLBACK','true'],['RENDER_GIT_COMMIT','unknown']])test('production rejects unsafe '+key,()=>assert.equal(validateProductionConfiguration({...config(),[key]:value}).valid,false));
test('secret checks detect placeholders, reuse and frontend variables without disclosing values',()=>{
  const env=config();env.CUSTOMER_API_KEY=env.OWNER_API_KEY;
  const result=validateProductionConfiguration({...env,VITE_API_KEY:'PRIVATE_FRONTEND_VALUE'});assert(!result.valid);assert(!JSON.stringify(result).includes(env.OWNER_API_KEY));assert(!JSON.stringify(result).includes('PRIVATE_FRONTEND_VALUE'));
});
test('database URL TLS options cannot disable certificate verification',()=>{
  const raw=databaseUrl()+'?sslmode=require';const result=secureDatabaseOptions(raw,{NODE_ENV:'production'},()=>{throw Error('NO_CA');});
  assert.deepEqual(result.ssl,{rejectUnauthorized:true});assert(!result.connectionString.includes('sslmode'));
  for(const query of ['sslmode=disable','uselibpqcompat=true','sslcert=private-path'])assert.throws(()=>secureDatabaseOptions(databaseUrl()+'?'+query,{NODE_ENV:'production'},()=>''));
  assert.throws(()=>secureDatabaseOptions(raw,{NODE_ENV:'production',DATABASE_SSL_REJECT_UNAUTHORIZED:'false'},()=>''));
});
test('discovery startup has no treasury/provider/worker dependency and fails closed on database failure',async()=>{
  let directoryCalls=0;const result=await startDiscoveryServices({initializeDatabase:async()=>({success:false,mode:'UNAVAILABLE'}),initializeDirectory:async()=>{directoryCalls++;}});
  assert.equal(result.success,false);assert.equal(result.liveReady,false);assert.equal(directoryCalls,0);
  const ready=await startDiscoveryServices({initializeDatabase:async()=>({success:true,mode:'TEST'}),initializeDirectory:async()=>{directoryCalls++;}});
  assert.equal(ready.success,true);assert.equal(ready.treasuryStatus,'DISABLED');assert.equal(ready.liveReady,false);
});
test('lifecycle is monotonic and drains idempotently without provider termination',async()=>{
  const runtime=new ServiceLifecycle();assert.equal(runtime.snapshot().state,'STARTING');runtime.complete(true);let stopped=0,closed=0;const exits:number[]=[];
  const shutdown=gracefulShutdown(runtime,()=>{stopped++;},async()=>{closed++;},code=>exits.push(code),100);
  await Promise.all([shutdown(),shutdown()]);assert.equal(stopped,1);assert.equal(closed,1);assert.deepEqual(exits,[0]);assert.equal(runtime.snapshot().state,'STOPPED');runtime.complete(true);assert.equal(runtime.snapshot().state,'STOPPED');
});
test('hung shutdown fails within its deadline and retains draining state',async()=>{
  const runtime=new ServiceLifecycle();runtime.complete(true);let exitCode=-1;
  await gracefulShutdown(runtime,()=>{},async()=>new Promise(()=>{}),code=>{exitCode=code;},5)();
  assert.equal(exitCode,1);assert.equal(runtime.snapshot().state,'DRAINING');
});
test('observability allowlist drops secrets, headers and raw errors',()=>{
  const event=operationalEvent('BOOTSTRAP_FAILED',{errorCode:'STARTUP_FAILED',secret:'secret-data',message:'secret-data',headers:{Authorization:'secret-data'},revision:'b'.repeat(40)});
  assert(!JSON.stringify(event).includes('secret-data'));assert.equal(event.errorCode,'STARTUP_FAILED');
});
test('migration plan rejects unknown, changed, duplicate and non-prefix history without executing',()=>{
  const a=migrationSource('20260101_first','SELECT 1'),b=migrationSource('20260102_second','SELECT 2'),p=migrationSource('20260103_proposal','SELECT 3',true);
  assert.equal(planMigrations([a,b,p],[]).compatible,false);
  const good=planMigrations([a,b,p],[a]);assert.equal(good.compatible,true);assert.deepEqual(good.pending,[b.version]);assert.deepEqual(good.proposals,[p.version]);assert.equal(good.executionAllowed,false);
  for(const history of [[b],[{...a,checksum:'0'.repeat(64)}],[a,a],[p]])assert.equal(planMigrations([a,b,p],history).compatible,false);
});
test('rollback review cannot execute a rollback or ignore schema/external effects',()=>{
  const r=rollbackAssessment({artifactRetained:true,previousRevision:'a'.repeat(40),currentSchemaCompatible:false,externalEffectsReconciled:false,backupRestoreRehearsed:false});assert.equal(r.eligibleForHumanReview,false);assert.equal(r.rollbackExecutionAllowed,false);
});
test('revoked collector keys invalidate fresh signed receipts without promoting test signatures',()=>{
  const pair=generateKeyPairSync('ed25519');const candidate=structuredClone(receipt);candidate.payload.origin='INDEPENDENT_READ_ONLY';candidate.signature=sign(null,Buffer.from(receiptBytes(candidate)),pair.privateKey).toString('base64');
  const issuer={publicKeyPem:pair.publicKey.export({type:'spki',format:'pem'}).toString(),kinds:['SUPPLIER' as const]};
  assert.equal(new EvidenceAuthority(new Map([[candidate.issuer,issuer]])).assess(candidate,'SUPPLIER','supplier:vast_ai','account_test01',now).status,'PARTIALLY_VERIFIED');
  assert.equal(new EvidenceAuthority(new Map([[candidate.issuer,{...issuer,revokedAtMs:now}]])).assess(candidate,'SUPPLIER','supplier:vast_ai','account_test01',now).status,'REJECTED');
});
test('launch review remains denied for absent or simulated evidence and exact release binding',()=>{
  const r=reviewLaunchEvidence('a'.repeat(40),'customer_test01','account_test01',{},new EvidenceAuthority(),now);assert.equal(r.activationAllowed,false);assert.equal(r.deploymentAllowed,false);assert(r.missing.length>=10);
});

test('emergency stop starts engaged, survives restart as engaged, and cannot be disarmed',()=>{
  const latch=new EmergencyStopLatch();assert.equal(latch.snapshot().engaged,true);assert.equal(latch.engage('OPERATOR').financialExecutionAllowed,false);assert.equal(latch.requestDisengage().allowed,false);assert.equal(new EmergencyStopLatch().snapshot().engaged,true);
});
test('independent billing review cannot use simulated final-invoice claims',()=>{
  const result=reviewIndependentBilling({...receipt,payload:{...receipt.payload,kind:'BILLING',subjectId:'resource:instance_test01'}},{resourceId:'instance_test01',accountId:'account_test01',startedAtMs:now-10000,deadlineMs:now,maxCostCents:200},new EvidenceAuthority(),now);
  assert.equal(result.status,'QUARANTINED');assert.equal(result.providerTerminationIssued,false);assert.equal(result.settlementAllowed,false);
});
test('read-only database reconnect verifies schema and recovers without runtime DDL',async()=>{
  const {PostgresDatabaseService}=await import('../server/pgDatabase.js');
  const service=new PostgresDatabaseService();let fail=false,releases=0;const statements:string[]=[];
  (service as any).pool={connect:async()=>({query:async(sql:string)=>{statements.push(sql);if(fail)throw Error('PRIVATE_DB');return {rows:[]};},release:()=>{releases++;}})};
  service.verifySchemaReadiness=async client=>{await client.query('SELECT 1 AS schema_fixture');};
  assert.equal(await service.probeReadiness(),true);fail=true;assert.equal(await service.probeReadiness(),false);fail=false;assert.equal(await service.probeReadiness(),true);
  assert.equal(releases,3);assert(statements.every(s=>s.startsWith('SELECT')));
});
