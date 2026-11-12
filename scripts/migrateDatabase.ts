import {loadDevelopmentMigrationEnvironment} from './migrationEnvironment.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {Client} from 'pg';
import {secureDatabaseOptions} from '../server/phase21/configuration.js';
import {classifyPostgresError} from '../server/diagnostics/postgres.js';
loadDevelopmentMigrationEnvironment();
let migrationClient:Client|undefined;

type Migration = {
  version: string;
  sql: string;
  checksum: string;
};

const MIGRATION_LOCK_ID = 9112026;

function migrationErrorCode(error:unknown):string {
  const message=error instanceof Error?error.message:'';
  const allowed=['MIGRATION_BLOCKED','MIGRATION_DATABASE_REQUIRED','MIGRATION_IDENTITY_REQUIRED','MIGRATION_TARGET_IDENTITY_MISMATCH','MIGRATION_LOCK_TIMEOUT','MIGRATION_PREFLIGHT_FAILED','MIGRATION_INTEGRITY_FAILURE','PHASE23_BASELINE_REQUIRED','PHASE23_BASELINE_INCOMPATIBLE','PHASE23_COLUMN_POLICY_CONFLICT','COMMERCIAL_SCHEMA_INCOMPATIBLE'];
  const code=message.split(':')[0];
  if(allowed.includes(code))return code;
  const sqlstate=typeof error==='object'&&error!==null&&'code' in error?error.code:undefined;
  if(sqlstate==='55P03')return 'MIGRATION_LOCK_NOT_AVAILABLE';
  if(sqlstate==='57014')return 'MIGRATION_STATEMENT_TIMEOUT';
  return 'MIGRATION_FAILED';
}


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

  // Dedicated offline client: migrations must not depend on the application schema
  // they are preparing. No fallback is permitted for an explicitly authorized target.
  const raw=process.env.DATABASE_URL;
  if(!raw)throw Error('MIGRATION_DATABASE_REQUIRED');
  const client=new Client({...secureDatabaseOptions(raw,process.env,p=>fs.readFileSync(p,'utf8')),
    query_timeout:35000,statement_timeout:30000});
  migrationClient=client;
  await client.connect();
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
         host(inet_server_addr()) AS server_address,
         host(inet_client_addr()) AS client_address`
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
      if(process.env.DB_MIGRATION_FRESH_INSTALL!=='EXPLICITLY_AUTHORIZED')throw new Error('MIGRATION_PREFLIGHT_FAILED: Fresh database bootstrap is not authorized.');
      await client.query(`CREATE TABLE schema_migrations (version varchar(64) PRIMARY KEY,checksum varchar(128) NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())`);
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
        // One explicit additive prerequisite was introduced after legacy v5 deployments.
        // It is still applied and checksummed below; no other history hole is accepted.
        if(migration.version==='20261109999999_commercial_intake_prerequisites' && applied.has('20261110_v5_commercial_evidence'))continue;
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
          classifyPostgresError(error)
        );
      }
    }

    await client.end();
    migrationClient=undefined;
  }
}

runVersionedMigrations()
  .catch(error => {
    console.error('[MIGRATE FATAL]', {code:migrationErrorCode(error),category:classifyPostgresError(error)});
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await migrationClient?.end();
    } catch (error) {
      console.error('[MIGRATE CLEANUP FAILED]', 'UNAVAILABLE');
      process.exitCode = 1;
    }
  });
