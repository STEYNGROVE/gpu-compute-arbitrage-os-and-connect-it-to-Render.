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
    console.log('PASS: isolated commercial evidence migration/replay, unverified defaults, state/cost/unique/FK constraints and rollback');
  } finally { client.release(); }
}
