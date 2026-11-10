import '../server/bootstrap.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pgDbService } from '../server/pgDatabase.js';

type Migration = {
  version: string;
  sql: string;
  checksum: string;
};

const MIGRATION_LOCK_ID = 9112026;

function loadMigrations(): Migration[] {
  const dir = path.join(
    process.cwd(),
    'supabase',
    'migrations'
  );

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    throw new Error('No migration files found');
  }

  const versions = new Set<string>();

  return files.map(file => {
    const version = file.replace(/\.sql$/, '');

    if (versions.has(version)) {
      throw new Error(
        `Duplicate migration version: ${version}`
      );
    }

    versions.add(version);

    const sql = fs.readFileSync(
      path.join(dir, file),
      'utf8'
    );

    if (!sql.trim()) {
      throw new Error(`Empty migration: ${file}`);
    }

    // Transaction boundaries belong to this runner.
    // Reject standalone transaction-control statements.
    const statements = sql
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/--[^\r\n]*/g, '');

    if (
      /^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\s*;/im
        .test(statements)
    ) {
      throw new Error(
        `Migration contains transaction control: ${file}`
      );
    }

    const checksum = crypto
      .createHash('sha256')
      .update(sql.trim())
      .digest('hex');

    return { version, sql, checksum };
  });
}

async function runVersionedMigrations() {
  console.log(
    '=== PHASE 9.12 SAFE MIGRATION RUNNER ==='
  );

  const migrations = loadMigrations();

  console.log(
    `[MIGRATE] Validated ${migrations.length} source files`
  );

  // Default behavior: no database connection or DDL.
  if (process.env.DB_MIGRATION_EXECUTE !==
      'EXPLICITLY_AUTHORIZED') {
    console.log(
      '[MIGRATE] VALIDATION ONLY — database untouched'
    );
    return;
  }

  // An additional explicit database-target confirmation
  // is required for any future execution.
  const target = process.env.DB_MIGRATION_TARGET;

  if (!target ||
      process.env.DB_MIGRATION_TARGET_CONFIRM !== target) {
    throw new Error(
      'MIGRATION_BLOCKED: Database target confirmation missing'
    );
  }

  const initRes = await pgDbService.initialize({
    skipSchemaCheck: true
  });

  if (!pgDbService.isLiveDatabaseConnected()) {
    throw new Error(
      `PostgreSQL unavailable: ${
        initRes.error || 'Disconnected'
      }`
    );
  }

  const client = await pgDbService.getClient();
  let locked = false;

  try {
    // Verify the actual connected database before acquiring
    // a migration lock or executing any migration SQL.
    const expectedDatabase =
      process.env.DB_MIGRATION_EXPECT_DATABASE;
    const expectedPort =
      process.env.DB_MIGRATION_EXPECT_PORT;
    const expectedTransport =
      process.env.DB_MIGRATION_EXPECT_TRANSPORT;
    const expectedAddress =
      process.env.DB_MIGRATION_EXPECT_SERVER_ADDRESS;

    if (
      !expectedDatabase ||
      !expectedPort ||
      !/^[0-9]+$/.test(expectedPort) ||
      Number(expectedPort) < 1 ||
      Number(expectedPort) > 65535 ||
      !['unix', 'tcp'].includes(expectedTransport || '') ||
      (expectedTransport === 'tcp' && !expectedAddress)
    ) {
      throw new Error(
        'MIGRATION_IDENTITY_REQUIRED: ' +
        'Expected database, port and transport are required; ' +
        'TCP also requires expected server address'
      );
    }

    const identity = await client.query(
      `SELECT
         current_database() AS database_name,
         current_setting('port') AS server_port,
         inet_server_addr()::text AS server_address,
         inet_client_addr()::text AS client_address`
    );

    const actual = identity.rows[0];

    const transportMatches =
      expectedTransport === 'unix'
        ? actual?.client_address == null &&
          actual?.server_address == null
        : actual?.client_address != null &&
          actual?.server_address === expectedAddress;

    if (
      actual?.database_name !== expectedDatabase ||
      String(actual?.server_port) !==
        String(Number(expectedPort)) ||
      !transportMatches
    ) {
      throw new Error(
        'MIGRATION_TARGET_IDENTITY_MISMATCH: ' +
        'Connected database does not match authorized identity'
      );
    }

    console.log(
      '[MIGRATE] Connected database identity verified'
    );

    // Session-scoped lock, held on this same client
    // until every migration completes.
    const lockDeadline = Date.now() + 10000;

    while (Date.now() < lockDeadline) {
      const result = await client.query(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [MIGRATION_LOCK_ID]
      );

      if (result.rows[0]?.acquired === true) {
        locked = true;
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 250));
    }

    if (!locked) {
      throw new Error(
        'MIGRATION_LOCK_TIMEOUT: ' +
        'Another migration holds the advisory lock'
      );
    }

    const tableCheck = await client.query(
      "SELECT to_regclass('public.schema_migrations') AS table_name"
    );

    if (!tableCheck.rows[0]?.table_name) {
      throw new Error(
        'MIGRATION_PREFLIGHT_FAILED: ' +
        'schema_migrations missing. ' +
        'Fresh database bootstrap is not authorized.'
      );
    }

    const history = await client.query(
      'SELECT version, checksum FROM schema_migrations'
    );

    const applied = new Map<string, string>();

    for (const row of history.rows) {
      const version = String(row.version).trim();
      const checksum = String(row.checksum).trim();

      if (applied.has(version)) {
        throw new Error(
          `Duplicate migration history: ${version}`
        );
      }

      applied.set(version, checksum);
    }

    const sources = new Map(
      migrations.map(m => [m.version, m])
    );

    // Complete integrity preflight before any DDL.
    for (const [version, checksum] of applied) {
      const source = sources.get(version);

      if (!source) {
        throw new Error(
          `MIGRATION_PREFLIGHT_FAILED: Missing source ${version}`
        );
      }

      const storedChecksum = checksum;
      const currentChecksum = source.checksum;

      if (storedChecksum !== currentChecksum) {
        throw new Error(
          `MIGRATION_INTEGRITY_FAILURE: Checksum mismatch ${version}`
        );
      }
    }

    // Fail closed on non-prefix migration history.
    // A previously applied later migration must not
    // conceal an unapplied earlier migration.
    let missingSeen = false;

    for (const migration of migrations) {
      if (!applied.has(migration.version)) {
        missingSeen = true;
      } else if (missingSeen) {
        throw new Error(
          'MIGRATION_PREFLIGHT_FAILED: ' +
          'Out-of-order migration history'
        );
      }
    }

    console.log(
      '[MIGRATE] All existing checksums verified'
    );

    for (const migration of migrations) {
      if (applied.has(migration.version)) {
        console.log(
          `[MIGRATE] Verified ${migration.version}`
        );
        continue;
      }

      await client.query('BEGIN');

      try {
        await client.query(migration.sql);

        await client.query(
          `INSERT INTO schema_migrations
           (version, checksum, applied_at)
           VALUES ($1, $2, NOW())`,
          [migration.version, migration.checksum]
        );

        await client.query('COMMIT');

        console.log(
          `[MIGRATE] Applied ${migration.version}`
        );
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log(
      '[MIGRATE] Migration verification complete'
    );
  } finally {
    if (locked) {
      try {
        await client.query(
          'SELECT pg_advisory_unlock($1)',
          [MIGRATION_LOCK_ID]
        );
      } catch (error) {
        console.error(
          '[MIGRATE] Advisory unlock failed',
          error
        );
      }
    }

    client.release();
  }
}

runVersionedMigrations()
  .catch(error => {
    console.error('[MIGRATE FATAL]', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pgDbService.close();
    } catch (error) {
      console.error('[MIGRATE CLEANUP FAILED]', error);
      process.exitCode = 1;
    }
  });
