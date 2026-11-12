import assert from 'node:assert/strict';
import { test } from 'node:test';
import { secureDatabaseOptions } from '../server/phase21/configuration.js';

const url = (host: string) =>
  `postgresql://user:password@${host}:5432/db`;

const env = {
  NODE_ENV: 'production',
  RENDER_SERVICE_ID: 'srv-example',
  RENDER_INTERNAL_DB_HOST: 'dpg-example-a'
};

const options = (
  host: string,
  extra: Record<string, string> = {}
) => secureDatabaseOptions(
  url(host),
  { ...env, ...extra },
  () => { throw Error('Unexpected CA read'); }
);

test('Render internal host currently uses non-TLS', () => {
  assert.equal(
    options('dpg-example-a').ssl,
    undefined
  );
});

test('external PostgreSQL requires verified TLS', () => {
  assert.deepEqual(
    options('database.example.com').ssl,
    { rejectUnauthorized: true }
  );
});

test('unknown internal-style host must not bypass TLS', () => {
  assert.deepEqual(
    options('dpg-untrusted-a').ssl,
    { rejectUnauthorized: true }
  );
});

test('non-Render environment requires TLS', () => {
  const result = secureDatabaseOptions(
    url('dpg-example-a'),
    { NODE_ENV: 'production' },
    () => ''
  );
  assert.deepEqual(result.ssl, { rejectUnauthorized: true });
});

test('insecure TLS override is rejected', () => {
  assert.throws(
    () => options('database.example.com', {
      DATABASE_SSL_REJECT_UNAUTHORIZED: 'false'
    }),
    /DATABASE_TLS_REQUIRED/
  );
});
