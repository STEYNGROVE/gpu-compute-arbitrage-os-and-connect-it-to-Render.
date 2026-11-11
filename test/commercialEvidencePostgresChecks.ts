import { ComputeJobRepository } from '../server/repositories/operationJobSettlementOutboxRepo.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';

/** Caller supplies the disposable cluster's random schema; never opens a connection. */
export async function verifyCommercialEvidenceSchema(pool: Pool) {
  await pool.query('CREATE TABLE commercial_quote_requests (id uuid PRIMARY KEY)');
  const migration = readFileSync('supabase/migrations/20261110_v5_commercial_evidence.sql', 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(migration);
    await client.query('COMMIT');
    // Reapplying this new schema is harmless; migration history/checksums remain runner-owned.
    await client.query(migration);
    const request = '12345678-1234-4123-8123-123456789012';
    await client.query('INSERT INTO commercial_quote_requests(id) VALUES($1)', [request]);
    await client.query('INSERT INTO commercial_verification(request_id) VALUES($1)', [request]);
    await client.query(`INSERT INTO commercial_quote_evidence(id,request_id,version,customer_rate_usd_per_gpu_hour,provider_rate_usd_per_gpu_hour,additional_cost_usd,valid_until)
      VALUES('22345678-1234-4123-8123-123456789012',$1,1,2,1,0,now()+interval '1 day')`, [request]);
    assert.equal((await client.query('SELECT state FROM commercial_verification')).rows[0].state, 'UNVERIFIED');
    assert.equal((await client.query('SELECT state FROM commercial_quote_evidence')).rows[0].state, 'DRAFT');
    await assert.rejects(client.query("UPDATE commercial_quote_evidence SET state='PAID'"), /check constraint/);
    await assert.rejects(client.query('UPDATE commercial_quote_evidence SET provider_rate_usd_per_gpu_hour=-1'), /check constraint/);
    await assert.rejects(client.query(`INSERT INTO commercial_quote_evidence(id,request_id,version,customer_rate_usd_per_gpu_hour,provider_rate_usd_per_gpu_hour,additional_cost_usd,valid_until)
      VALUES('32345678-1234-4123-8123-123456789012',$1,1,2,1,0,now())`, [request]), /unique constraint/);
    await assert.rejects(client.query('DELETE FROM commercial_quote_requests WHERE id=$1', [request]), /foreign key constraint/);
    await client.query('BEGIN');
    await client.query("UPDATE commercial_quote_evidence SET state='VOID'");
    await client.query('ROLLBACK');
    assert.equal((await client.query('SELECT state FROM commercial_quote_evidence')).rows[0].state, 'DRAFT');
    await client.query('CREATE TABLE compute_jobs (job_id varchar(64) PRIMARY KEY, gpu_count integer NOT NULL, actual_cost numeric, status text NOT NULL)');
    await client.query(`INSERT INTO compute_jobs VALUES ('active',2,NULL,'RUNNING'), ('stale',8,50,'COMPLETED'), ('unrelated-terminal',1,1,'COMPLETED')`);
    class ExposureRepository extends ComputeJobRepository {
      protected async query<T = any>(sql: string, params: any[] = []): Promise<any> { return pool.query(sql, params); }
    }
    const exposure = new ExposureRepository();
    const rows = await exposure.listExposureJobs(['stale', 'memory-only']);
    assert.deepEqual(rows.map(row=>row.jobId).sort(), ['active','stale']);
    assert.equal(rows.find(row=>row.jobId==='stale')!.status,'COMPLETED');
    assert.equal((await exposure.listExposureJobs(["missing'); DROP TABLE compute_jobs; --"])).length,1);
    console.log('PASS: real PostgreSQL exposure query includes active and terminal matches without unrelated terminal jobs');
    console.log('PASS: isolated commercial evidence migration/replay, unverified defaults, state/cost/unique/FK constraints and rollback');
  } finally { client.release(); }
}
