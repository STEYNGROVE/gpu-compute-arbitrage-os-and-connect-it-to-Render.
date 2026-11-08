const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Client } = require('pg');

async function main() {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) throw Error('TEST_DATABASE_URL_REQUIRED');
  if (process.env.ALLOW_ISOLATED_GPU_DB_TEST !== 'YES')
    throw Error('TEST_OPT_IN_REQUIRED');
  if (process.env.RENDER || process.env.NODE_ENV === 'production')
    throw Error('DEPLOYMENT_ENVIRONMENT_FORBIDDEN');

  const parsed = new URL(url);

  if (!['127.0.0.1', 'localhost'].includes(parsed.hostname))
    throw Error('LOCAL_DATABASE_ONLY');

  if (parsed.port !== '55439')
    throw Error('UNEXPECTED_TEST_PORT');

  if (parsed.pathname !== '/gpu_commercial_test')
    throw Error('UNEXPECTED_DATABASE');

  if (process.env.DATABASE_URL &&
      process.env.DATABASE_URL === url)
    throw Error('PRODUCTION_DATABASE_FORBIDDEN');

  const schema = 'usdt_test_' + randomBytes(8).toString('hex');
  const db = new Client({ connectionString: url });

  await db.connect();

  try {
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.query(`SET search_path TO "${schema}"`);

    await db.query(`
      CREATE TABLE invoices (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'PENDING',
        chain_id INTEGER,
        tx_hash TEXT,
        log_index INTEGER,
        paid_at TIMESTAMPTZ
      )
    `);

    await db.query(`
      CREATE UNIQUE INDEX unique_payment_event
      ON invoices(chain_id, tx_hash, log_index)
      WHERE tx_hash IS NOT NULL
    `);

    await db.query(`
      INSERT INTO invoices(id) VALUES ('invoice_a'),('invoice_b')
    `);

    const hash = '0x' + 'a'.repeat(64);

    await db.query('BEGIN');

    await db.query(`
      UPDATE invoices
      SET status='PAID',
          chain_id=1,
          tx_hash=$1,
          log_index=0,
          paid_at=NOW()
      WHERE id='invoice_a'
    `, [hash]);

    await db.query('COMMIT');

    console.log('PASS: first payment allocation committed');

    let duplicateRejected = false;

    try {
      await db.query('BEGIN');

      await db.query(`
        UPDATE invoices
        SET status='PAID',
            chain_id=1,
            tx_hash=$1,
            log_index=0,
            paid_at=NOW()
        WHERE id='invoice_b'
      `, [hash]);

      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      duplicateRejected = error.code === '23505';
    }

    assert.equal(duplicateRejected, true);

    console.log('PASS: duplicate blockchain event rejected');

    const rows = await db.query(`
      SELECT id,status FROM invoices ORDER BY id
    `);

    assert.equal(rows.rows[0].status, 'PAID');
    assert.equal(rows.rows[1].status, 'PENDING');

    console.log('PASS: failed duplicate allocation rolled back');
    console.log('PASS: original payment remains intact');

    const count = await db.query(`
      SELECT COUNT(*)::int AS n
      FROM invoices WHERE status='PAID'
    `);

    assert.equal(count.rows[0].n, 1);

    console.log('PASS: exactly one invoice paid');
    console.log('PAYMENT DATABASE CONSTRAINT TESTS PASSED');
  } finally {
    try {
      await db.query('RESET search_path');
      await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await db.end();
    }
  }
}

main().catch(error => {
  console.error('PAYMENT TEST FAILED:', error);
  process.exitCode = 1;
});
