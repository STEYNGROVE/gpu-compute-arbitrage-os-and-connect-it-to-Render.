const assert = require('node:assert/strict');
const { Client } = require('pg');
const { randomBytes } = require('node:crypto');

async function main() {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) throw Error('TEST_DATABASE_URL_REQUIRED');
  if (process.env.ALLOW_ISOLATED_GPU_DB_TEST !== 'YES')
    throw Error('TEST_OPT_IN_REQUIRED');

  if (process.env.RENDER || process.env.NODE_ENV === 'production')
    throw Error('PRODUCTION_ENVIRONMENT_FORBIDDEN');

  const parsed = new URL(url);

  assert.equal(parsed.hostname, '127.0.0.1');
  assert.equal(parsed.port, '55439');
  assert.equal(parsed.pathname, '/gpu_commercial_test');

  const schema = 'usdt_ledger_' + randomBytes(8).toString('hex');
  const client = new Client({ connectionString: url });

  await client.connect();

  try {
    await client.query(`CREATE SCHEMA "${schema}"`);

    const isolatedUrl = new URL(url);
    isolatedUrl.searchParams.set('options', `-c search_path=${schema}`);

    const isolated = new Client({
      connectionString: isolatedUrl.toString()
    });

    try {
      await isolated.connect();

      const result = await isolated.query(
        'SELECT current_schema() AS schema'
      );

      assert.equal(result.rows[0].schema, schema);

      console.log('PASS: isolated invoice schema selected');
      console.log('PASS: no production database connection');
      console.log('PASS: application test URL prepared');
    } finally {
      await isolated.end();
    }
  } finally {
    try {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await client.end();
    }
  }
}

main().catch(error => {
  console.error('FAIL:', error);
  process.exitCode = 1;
});
