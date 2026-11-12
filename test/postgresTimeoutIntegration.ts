import assert from 'node:assert/strict';
import pg from 'pg';
import { secureDatabaseOptions } from '../server/phase21/configuration.js';

// Only called by the disposable-cluster harness with a generated loopback URL.
const raw=process.env.TEST_DATABASE_URL;
if(!raw || process.env.ALLOW_ISOLATED_GPU_DB_TEST!=='YES' || process.env.NODE_ENV!=='test' || process.env.RENDER || process.env.DATABASE_URL)throw Error('ISOLATED_FIXTURE_REQUIRED');
const url=new URL(raw);
if(url.hostname!=='127.0.0.1' || url.pathname!=='/phase16_test' || url.username!=='phase16_testowner' || url.search)throw Error('ISOLATED_FIXTURE_REQUIRED');
const client=new pg.Client(secureDatabaseOptions(raw,process.env,()=>{throw Error('NO_CA_EXPECTED');}));
try {
  await client.connect();
  const started=Date.now();
  await assert.rejects(client.query('SELECT pg_sleep(20)'),(error:unknown)=>{
    const e=error as {code?:string;message?:string};
    return e.code==='57014' || e.message==='Query read timeout';
  });
  assert.ok(Date.now()-started<15000,'configured five-second query/statement deadline must stop the query');
  // Server-side cancellation must also permit subsequent read-only work.
  assert.equal((await client.query('SELECT 1 AS ok')).rows[0].ok,1);
  console.log('PASS: actual PostgreSQL query/statement timeout and subsequent read-only recovery');
} finally {await client.end();}
