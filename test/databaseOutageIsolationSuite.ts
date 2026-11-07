import assert from 'node:assert/strict';
import { pgDbService } from '../server/pgDatabase.js';

async function main() {
  const db = pgDbService as any;

  const originalConnected = db.isConnected;
  const originalPool = db.pool;

  try {
    db.isConnected = false;
    db.pool = null;

    assert.equal(
      db.isConnected,
      false,
      'PostgreSQL must be disconnected during the test'
    );

    const liveCheck = db.assertLiveModeAllowed();

    assert.equal(liveCheck.allowed, false);

    await assert.rejects(
      db.query('SELECT 1'),
      /DATABASE_UNAVAILABLE/
    );

    await assert.rejects(
      db.getClient(),
      /DATABASE_UNAVAILABLE/
    );

    console.log('PASS: Disconnected PostgreSQL reports unavailable');
    console.log('PASS: Live execution remains blocked');
    console.log('PASS: Database queries fail closed');
    console.log('PASS: Database client acquisition fails closed');
    console.log('DATABASE OUTAGE ISOLATION: 4/4 PASSED');
  } finally {
    db.isConnected = originalConnected;
    db.pool = originalPool;
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
