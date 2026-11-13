import assert from 'node:assert/strict';
import pg from 'pg';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,readdirSync,rmSync,chmodSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {setDefaultResultOrder} from 'node:dns';
import {secureDatabaseOptions} from '../server/phase21/configuration.js';

const raw=process.env.TEST_DATABASE_URL;
if(!raw||process.env.NODE_ENV!=='test'||process.env.ALLOW_ISOLATED_GPU_DB_TEST!=='YES'||process.env.RENDER||process.env.DATABASE_URL)throw Error('ISOLATED_FIXTURE_REQUIRED');
const target=new URL(raw);
if(target.hostname!=='127.0.0.1'||target.username!=='phase16_testowner'||target.pathname!=='/phase16_test'||!target.port||target.search)throw Error('ISOLATED_FIXTURE_REQUIRED');
const repo=process.cwd();const directory=mkdtempSync(path.join(tmpdir(),'phase23-recovery-'));
const suffix=randomBytes(5).toString('hex'),source='phase23_source_test_'+suffix,restored='phase23_restore_test_'+suffix;
const admin=new pg.Client({connectionString:raw});let adminConnected=false;let sourceClient:pg.Client|undefined,restoreClient:pg.Client|undefined;
const sqlPath='docs/migration-proposals/20261112_phase23_acquisition_publication.sql';
const sql=readFileSync(sqlPath,'utf8'),version=path.basename(sqlPath,'.sql');
const digest=(text:string)=>createHash('sha256').update(text.trim()).digest('hex');
const sqlHash=digest(sql);
const cert=process.env.TEST_DATABASE_SSL_CA;if(!cert)throw Error('ISOLATED_TLS_FIXTURE_REQUIRED');
const env={...process.env,PGPASSWORD:decodeURIComponent(target.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:cert};
const args=['-h',target.hostname,'-p',target.port,'-U',target.username];
function command(exe:string,argv:string[]) {const r=spawnSync(exe,argv,{env,encoding:'utf8',timeout:30000});assert.equal(r.status,0,exe+' failed in disposable fixture');}
let passed=0;
async function check(name:string,fn:()=>Promise<void>){await fn();passed++;console.log('PHASE23_PG_PASS '+name);}
const migrationDir=path.join(directory,'supabase','migrations');mkdirSync(migrationDir,{recursive:true});
const files=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
for(const file of files)writeFileSync(path.join(migrationDir,file),readFileSync(path.join('supabase/migrations',file)));
writeFileSync(path.join(migrationDir,version+'.sql'),sql);
const sourceUrl=new URL(target);sourceUrl.pathname='/'+source;
function runner(changes:Record<string,string|undefined>={},execute=true){
  const childEnv:NodeJS.ProcessEnv={...process.env,DATABASE_URL:sourceUrl.href,DB_MIGRATION_EXECUTE:execute?'EXPLICITLY_AUTHORIZED':undefined,
    DB_MIGRATION_TARGET:'DISPOSABLE_PHASE23',DB_MIGRATION_TARGET_CONFIRM:'DISPOSABLE_PHASE23',DB_MIGRATION_EXPECT_DATABASE:source,
    DB_MIGRATION_EXPECT_PORT:target.port,DB_MIGRATION_EXPECT_TRANSPORT:'tcp',DB_MIGRATION_EXPECT_SERVER_ADDRESS:'127.0.0.1',...changes};
  for(const key of ['DIRECT_URL','SUPABASE_DB_URL','POSTGRES_URL','RENDER'])delete childEnv[key];
  if(!Object.hasOwn(changes,'DATABASE_SSL_CA'))delete childEnv.DATABASE_SSL_CA;
  const r=spawnSync(process.execPath,['--import',import.meta.resolve('tsx'),path.join(repo,'scripts/migrateDatabase.ts')],{cwd:directory,env:childEnv,encoding:'utf8',timeout:50000});
  assert.ifError(r.error);assert.ok(!(r.stdout+r.stderr).includes(decodeURIComponent(target.password)),'migration logs must not disclose password');
  return r;
}
const exists=async()=> (await sourceClient!.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='acquisition_leads' AND column_name='published_at'")).rows[0].n===1;
try {
  await admin.connect();adminConnected=true;
  await check('actual PostgreSQL accepts trusted CA with verified IP identity',async()=>{
    const client=new pg.Client(secureDatabaseOptions(raw,{NODE_ENV:'production',DATABASE_SSL_CA:cert},p=>readFileSync(p,'utf8')));
    try{await client.connect();assert.equal((await client.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0].ssl,true);}finally{await client.end();}
  });
  await check('actual PostgreSQL rejects untrusted certificate without configured CA',async()=>{
    const client=new pg.Client(secureDatabaseOptions(raw,{NODE_ENV:'production'},()=>''));
    try{await assert.rejects(client.connect(),(e:unknown)=>/SELF_SIGNED|UNABLE_TO_VERIFY/.test(String((e as {code?:string}).code)));}finally{await client.end();}
  });
  await check('actual PostgreSQL rejects trusted certificate for a mismatching hostname',async()=>{
    setDefaultResultOrder('ipv4first');const wrongHost=new URL(raw);wrongHost.hostname='localhost';
    const client=new pg.Client(secureDatabaseOptions(wrongHost.href,{NODE_ENV:'production',DATABASE_SSL_CA:cert},p=>readFileSync(p,'utf8')));
    try{await assert.rejects(client.connect(),(e:unknown)=>(e as {code?:string}).code==='ERR_TLS_CERT_ALTNAME_INVALID');}finally{await client.end();}
  });
  await admin.query('CREATE DATABASE "'+source+'"');
  sourceClient=new pg.Client({connectionString:sourceUrl.href});await sourceClient.connect();
  // Shape recorded in Phase22: seven columns, description present, publication absent.
  await sourceClient.query(`CREATE TABLE public.acquisition_leads (id text PRIMARY KEY,title text NOT NULL,source_url text NOT NULL UNIQUE,source_feed text NOT NULL,discovered_at timestamptz NOT NULL DEFAULT now(),status text NOT NULL DEFAULT 'CANDIDATE',description text,CHECK(status IN ('CANDIDATE','REVIEWING','QUALIFIED','REJECTED')));
    CREATE TABLE public.schema_migrations(version varchar PRIMARY KEY,checksum varchar NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());`);
  for(const file of files)await sourceClient.query('INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)',[file.slice(0,-4),digest(readFileSync(path.join('supabase/migrations',file),'utf8'))]);
  await sourceClient.query("INSERT INTO acquisition_leads(id,title,source_url,source_feed,description) VALUES('legacy','Unknown publication','https://example.org/legacy','https://example.org/feed','historical fixture')");
  await check('validation-only CLI never opens the deliberately invalid database URL',async()=>{assert.equal(runner({DATABASE_URL:'invalid'},false).status,0);assert.equal(await exists(),false);});
  await check('wrong database identity rejects before DDL',async()=>{const r=runner({DB_MIGRATION_EXPECT_DATABASE:'wrong_test'});assert.equal(r.status,1);assert.match(r.stderr,/MIGRATION_TARGET_IDENTITY_MISMATCH/);assert.equal(await exists(),false);});
  await check('historical checksum drift rejects before DDL',async()=>{
    const file=path.join(migrationDir,files[0]);const original=readFileSync(file,'utf8');writeFileSync(file,original+'\n-- deliberate fixture drift\n');
    try{const r=runner();assert.equal(r.status,1);assert.match(r.stderr,/MIGRATION_INTEGRITY_FAILURE/);assert.equal(await exists(),false);}finally{writeFileSync(file,original);}
  });
  await check('incompatible existing publication type fails atomically without history entry',async()=>{
    await sourceClient!.query('ALTER TABLE acquisition_leads ADD COLUMN published_at text');const r=runner();assert.equal(r.status,1);assert.match(r.stderr,/PHASE23_COLUMN_POLICY_CONFLICT/);
    assert.equal((await sourceClient!.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n,files.length);
    await sourceClient!.query('ALTER TABLE acquisition_leads DROP COLUMN published_at');
  });
  await check('blocking reader yields bounded migration lock failure with no partial change',async()=>{
    const blocker=new pg.Client({connectionString:sourceUrl.href});await blocker.connect();
    try{await blocker.query('BEGIN');await blocker.query('LOCK TABLE acquisition_leads IN ACCESS SHARE MODE');const r=runner();assert.equal(r.status,1);assert.match(r.stderr,/MIGRATION_LOCK_NOT_AVAILABLE/);assert.equal(await exists(),false);}
    finally{await blocker.query('ROLLBACK');await blocker.end();}
  });
  await check('Phase24 transaction rollback leaves publication absent and legacy rows unchanged',async()=>{
    const before=(await sourceClient!.query('SELECT * FROM public.acquisition_leads ORDER BY id')).rows;
    await sourceClient!.query('BEGIN');
    try{await sourceClient!.query(sql);assert.equal(await exists(),true);}finally{await sourceClient!.query('ROLLBACK');}
    assert.equal(await exists(),false);
    assert.deepEqual((await sourceClient!.query('SELECT * FROM public.acquisition_leads ORDER BY id')).rows,before);
  });
  await check('authorized isolated CLI applies forward migration and records exact checksum once',async()=>{
    const r=runner({NODE_ENV:'production',DATABASE_SSL_CA:cert});assert.equal(r.status,0,'isolated migration runner failed: '+r.stderr);assert.equal(await exists(),true);
    assert.equal((await sourceClient!.query('SELECT checksum FROM schema_migrations WHERE version=$1',[version])).rows[0].checksum,sqlHash);
    assert.equal((await sourceClient!.query("SELECT published_at FROM acquisition_leads WHERE id='legacy'")).rows[0].published_at,null);
    assert.equal(runner().status,0);assert.equal((await sourceClient!.query('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n,files.length+1);
  });
  await check('column policy is timestamptz nullable without default and historical rows remain unchanged',async()=>{
    const c=(await sourceClient!.query("SELECT data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='acquisition_leads' AND column_name='published_at'")).rows[0];
    assert.deepEqual(c,{data_type:'timestamp with time zone',is_nullable:'YES',column_default:null});
    await sourceClient!.query("INSERT INTO acquisition_leads(id,title,source_url,source_feed,published_at) VALUES('dated','Dated fixture','https://example.org/dated','https://example.org/feed','2026-11-12T14:00:00+02:00')");
    await sourceClient!.query('BEGIN');await sourceClient!.query(sql);await sourceClient!.query('COMMIT');
    const rows=(await sourceClient!.query('SELECT id,published_at FROM acquisition_leads ORDER BY id')).rows;
    assert.equal(rows[0].published_at.toISOString(),'2026-11-12T12:00:00.000Z');assert.equal(rows[1].published_at,null);
  });
  await check('unexpected publication defaults or NOT NULL policy are rejected without coercion',async()=>{
    for(const drift of ["ALTER TABLE acquisition_leads ALTER COLUMN published_at SET DEFAULT now()","UPDATE acquisition_leads SET published_at=now() WHERE published_at IS NULL; ALTER TABLE acquisition_leads ALTER COLUMN published_at SET NOT NULL"]){
      await sourceClient!.query('BEGIN');try{await sourceClient!.query(drift);await assert.rejects(sourceClient!.query(sql),/PHASE23_COLUMN_POLICY_CONFLICT/);}finally{await sourceClient!.query('ROLLBACK');}
    }
  });
  await check('Phase24 deployed legacy read/write SQL remains compatible without inventing publication dates',async()=>{
    // SQL shapes independently read from deployed commit 2482877 server/leadDiscovery.ts.
    await sourceClient!.query('BEGIN');
    try {
      const indexes=(await sourceClient!.query("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='acquisition_leads' ORDER BY indexname")).rows;
      const constraints=(await sourceClient!.query("SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.acquisition_leads'::regclass ORDER BY conname")).rows;
      const oldInsert=`INSERT INTO acquisition_leads (id,title,source_url,source_feed,description)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT(source_url) DO UPDATE SET description=EXCLUDED.description
        WHERE acquisition_leads.description IS NULL OR acquisition_leads.description='' RETURNING (xmax = 0) AS newly_inserted`;
      await sourceClient!.query(oldInsert,['old-writer','Legacy SQL','https://example.org/old-writer','https://example.org/feed','']);
      await sourceClient!.query(oldInsert,['different-id','Legacy SQL','https://example.org/old-writer','https://example.org/feed','updated']);
      assert.deepEqual((await sourceClient!.query("SELECT description,published_at FROM acquisition_leads WHERE id='old-writer'")).rows,[{description:'updated',published_at:null}]);
      const oldRead='SELECT id,title,source_url,source_feed,description,discovered_at,status FROM acquisition_leads ORDER BY discovered_at DESC LIMIT 100';
      assert.equal((await sourceClient!.query(oldRead)).rowCount,3);
      await sourceClient!.query('UPDATE acquisition_leads SET status=$1 WHERE id=$2 RETURNING id,status',['REVIEWING','old-writer']);
      await sourceClient!.query(sql);
      assert.deepEqual((await sourceClient!.query("SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='acquisition_leads' ORDER BY indexname")).rows,indexes);
      assert.deepEqual((await sourceClient!.query("SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.acquisition_leads'::regclass ORDER BY conname")).rows,constraints);
    } finally {await sourceClient!.query('ROLLBACK');}
  });
  await check('Phase24 public-qualified migration does not mutate a shadow table on search_path',async()=>{
    await sourceClient!.query('BEGIN');
    try {
      await sourceClient!.query('CREATE SCHEMA phase24_shadow; CREATE TABLE phase24_shadow.acquisition_leads(id text); SET LOCAL search_path=phase24_shadow,public');
      await sourceClient!.query(sql);
      assert.equal((await sourceClient!.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='phase24_shadow' AND table_name='acquisition_leads'")).rows[0].n,1);
      assert.equal(await exists(),true);
    } finally {await sourceClient!.query('ROLLBACK');}
  });
  await check('custom-format backup restores rows, NULL dates, schema and migration checksums into a new local database',async()=>{
    const started=Date.now();const dump=path.join(directory,'fixture.dump');
    command('pg_dump',[...args,'--format=custom','--no-owner','--file',dump,source]);chmodSync(dump,0o600);
    const hash=createHash('sha256').update(readFileSync(dump)).digest('hex');assert.equal(hash.length,64);
    await admin.query('CREATE DATABASE "'+restored+'"');command('pg_restore',[...args,'--no-owner','--exit-on-error','--dbname',restored,dump]);
    const restoredUrl=new URL(target);restoredUrl.pathname='/'+restored;restoreClient=new pg.Client({connectionString:restoredUrl.href});await restoreClient.connect();
    assert.deepEqual((await restoreClient.query('SELECT id,title,description,published_at,discovered_at FROM acquisition_leads ORDER BY id')).rows,(await sourceClient!.query('SELECT id,title,description,published_at,discovered_at FROM acquisition_leads ORDER BY id')).rows);
    assert.deepEqual((await restoreClient.query('SELECT version,checksum FROM schema_migrations ORDER BY version')).rows,(await sourceClient!.query('SELECT version,checksum FROM schema_migrations ORDER BY version')).rows);
    await restoreClient.query('SELECT id,title,source_url,source_feed,description,published_at,discovered_at,status FROM acquisition_leads LIMIT 0');
    console.log('PHASE23_RECOVERY '+JSON.stringify({scope:'SYNTHETIC_LOCAL_ONLY',dumpSha256:hash,bytes:readFileSync(dump).length,elapsedMs:Date.now()-started,rows:2}));
  });
  console.log('PHASE23_POSTGRES_COUNTS '+JSON.stringify({passed,failed:0,skipped:0}));
} finally {
  await restoreClient?.end();await sourceClient?.end();
  try {if(adminConnected){await admin.query('DROP DATABASE IF EXISTS "'+restored+'"');await admin.query('DROP DATABASE IF EXISTS "'+source+'"');}}
  finally {await admin.end();rmSync(directory,{recursive:true,force:true});}
}
