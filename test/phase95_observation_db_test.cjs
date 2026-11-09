const fs = require('node:fs');
const { Client } = require('pg');
const url = process.env.TEST_DATABASE_URL;
if (process.env.ALLOW_ISOLATED_GPU_DB_TEST !== 'YES' || !url) throw Error('Explicit isolated DB opt-in required');
const u = new URL(url);
if (!['127.0.0.1','localhost'].includes(u.hostname) || u.port !== '55439' || u.pathname !== '/gpu_commercial_test') throw Error('Refusing non-isolated DB');
const schema='phase95_obs_'+process.pid;
const q=(x)=>'"'+x.replace(/"/g,'""')+'"';
(async()=>{
 const db=new Client({connectionString:url}); await db.connect();
 try {
  await db.query('CREATE SCHEMA '+q(schema));
  await db.query('SET search_path TO '+q(schema));
  const sql=fs.readFileSync('migrations/20261109_payment_evidence_observations.sql','utf8');
  await db.query(sql);
  const insert='INSERT INTO gpu_payment_observations (provider,provider_transaction_id,customer_id,order_id,amount_minor,currency,evidence_sha256) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (provider,provider_transaction_id) DO NOTHING RETURNING id';
  const args=(tx,ord)=>['TEST','transaction-'+tx,'customer-1',ord,100,'USD','a'.repeat(64)];
  if((await db.query(insert,args('00000001','order-1'))).rowCount!==1) throw Error('initial observation failed');
  if((await db.query(insert,args('00000002','order-1'))).rowCount!==1) throw Error('same order incorrectly reserved');
  if((await db.query(insert,args('00000001','order-2'))).rowCount!==0) throw Error('duplicate transaction accepted');
  for(const sql of ['UPDATE gpu_payment_observations SET order_id=\'x\'','DELETE FROM gpu_payment_observations']){
   try{await db.query(sql);throw Error('mutation allowed')}catch(e){if(e.message==='mutation allowed')throw e;}
  }
  const count=await db.query('SELECT count(*)::int AS n FROM gpu_payment_observations');
  if(count.rows[0].n!==2) throw Error('unexpected row count');
  console.log('PASS: unverified observations do not reserve orders; duplicate transaction rejected; immutable rows');
 }finally{await db.query('DROP SCHEMA IF EXISTS '+q(schema)+' CASCADE');await db.end();}
})().catch(e=>{console.error('FAIL:',e.message);process.exitCode=1});
