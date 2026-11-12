import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyPostgresError } from '../server/diagnostics/postgres.js';

test('classifies PostgreSQL authentication failures', () => {
  assert.equal(
    classifyPostgresError({ code: '28P01' }),
    'AUTHENTICATION'
  );
});

test('classifies TLS certificate failures', () => {
  assert.equal(
    classifyPostgresError({
      code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
    }),
    'TLS_CERTIFICATE'
  );
});

test('classifies network failures', () => {
  assert.equal(
    classifyPostgresError({ code: 'ECONNREFUSED' }),
    'NETWORK_REFUSED'
  );
});

test('does not expose sensitive error messages', () => {
  const result = classifyPostgresError({
    code: 'UNKNOWN',
    message: 'password=SECRET123 DATABASE_URL=private'
  });

  assert.equal(result, 'UNCLASSIFIED');
  assert.ok(!result.includes('SECRET123'));
  assert.ok(!result.includes('private'));
});

test('handles null and malformed errors safely', () => {
  assert.equal(classifyPostgresError(null), 'UNCLASSIFIED');
  assert.equal(classifyPostgresError('secret'), 'UNCLASSIFIED');
  assert.equal(classifyPostgresError({ code: 123 }), 'UNCLASSIFIED');
});
