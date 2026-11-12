import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Pool } from 'pg';
import { persistAcquisitionLead, inMemoryLeadsStore, type AcquisitionLeadRecord } from '../server/leadDiscovery.js';
import { assessCustomerLeadEvidence } from '../server/customerLeadEvidence.js';

// Only called by the existing disposable-cluster harness inside its randomly named schema.
export async function verifyAcquisitionPublicationSchema(pool: Pool) {
  assert.equal(process.env.ALLOW_ISOLATED_GPU_DB_TEST, 'YES');
  assert.equal(process.env.DATABASE_URL, undefined);
  const migration = readFileSync('docs/migration-proposals/20261112_phase19_1_acquisition_publication.sql','utf8');
  // Existing baseline, with a legacy undated lead, then proposal upgrade and reapply.
  await pool.query(`CREATE TABLE acquisition_leads (
    id text PRIMARY KEY,title text NOT NULL,source_url text NOT NULL UNIQUE,source_feed text NOT NULL,
    discovered_at timestamptz NOT NULL DEFAULT now(),status text NOT NULL DEFAULT 'CANDIDATE',
    CHECK(status IN ('CANDIDATE','REVIEWING','QUALIFIED','REJECTED')))`);
  await pool.query("INSERT INTO acquisition_leads(id,title,source_url,source_feed) VALUES('legacy','Legacy','https://example.org/legacy','https://example.org/feed')");
  await pool.query(migration);
  await pool.query(migration);
  assert.equal((await pool.query("SELECT published_at FROM acquisition_leads WHERE id='legacy'")).rows[0].published_at, null);
  const lead: AcquisitionLeadRecord = {
    id:'publication-test', title:'RFQ H100 GPU inference', source_url:'https://example.org/jobs/101',
    source_feed:'https://example.org/feed', description:'Seeking a GPU provider',
    published_at:'2026-11-10T12:00:00.000Z', discovered_at:'2026-11-12T12:00:00Z', status:'CANDIDATE'
  };
  const writes = await Promise.all(Array.from({length:8}, () => persistAcquisitionLead(pool, lead)));
  assert.equal(writes.filter(Boolean).length, 1);
  const stored = (await pool.query('SELECT * FROM acquisition_leads WHERE id=$1',[lead.id])).rows[0];
  assert.equal(stored.description, lead.description);
  assert.equal(stored.published_at.toISOString(), lead.published_at);
  assert.equal(stored.source_url, lead.source_url);
  inMemoryLeadsStore.length = 0;
  assert.equal(await persistAcquisitionLead(null, lead), true);
  assert.equal(await persistAcquisitionLead(null, lead), false);
  assert.equal(inMemoryLeadsStore[0].description, stored.description);
  assert.equal(inMemoryLeadsStore[0].published_at, stored.published_at.toISOString());
  assert.equal(assessCustomerLeadEvidence({title:stored.title,description:stored.description,sourceUrl:stored.source_url,publishedAt:stored.published_at.toISOString()},new Date('2026-11-12T12:00:00Z')).status, 'CANDIDATE');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE acquisition_leads SET description='rolled back' WHERE id=$1",[lead.id]);
    await client.query('ROLLBACK');
  } finally { client.release(); }
  assert.equal((await pool.query('SELECT description FROM acquisition_leads WHERE id=$1',[lead.id])).rows[0].description,lead.description);
  inMemoryLeadsStore.length=0;
  console.log('PASS: acquisition proposal upgrade/reapply, legacy NULL dates, production insert concurrency/idempotency, evidence parity, rollback');
}
