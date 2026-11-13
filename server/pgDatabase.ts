import {verifyCommercialColumnTypes} from './commercialSchema.js';
import { classifyPostgresError } from './diagnostics/postgres.js';
import { secureDatabaseOptions } from './phase21/configuration.js';
import { liveOperationsAllowed } from './simulationSafety.js';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const { Pool } = pg;

function rethrowProgrammingError(error: unknown): void {
  if (error instanceof TypeError || error instanceof ReferenceError ||
      error instanceof SyntaxError || error instanceof RangeError) throw error;
}

export interface PgDatabaseConfig {
  connectionString?: string;
  maxConnections?: number;
}

/**
 * Authoritative PostgreSQL Database Service
 *
 * PRODUCTION SCHEMA IMMUTABILITY INVARIANT:
 * This runtime service NEVER executes DDL schema mutation statements
 * at startup or during normal operation.
 * All schema definitions and changes live strictly in versioned PostgreSQL
 * migration files under `supabase/migrations/` and are applied offline via
 * `npm run db:migrate`. At startup, `verifySchemaReadiness()` performs a
 * read-only verification against `information_schema.tables` and fails closed
 * if any required authoritative financial table is missing.
 */
export class PostgresDatabaseService {
  private pool: pg.Pool | null = null;
  private poolGeneration = 0;
  private healthGeneration = 0;
  private initializing?: Promise<{ success: boolean; mode: 'REMOTE_POSTGRES' | 'POSTGRES_DISCONNECTED'; error?: string }>;
  private probing?: Promise<boolean>;
  private closing?: Promise<void>;
  private readonly drains = new WeakMap<pg.Pool, Promise<void>>();
  private drainFailed = false;
  private readonly pendingDrains = new Set<Promise<void>>();
  private isConnected: boolean = false;
  private connectionError: string | null = null;
  private isInitialized: boolean = false;

  constructor(private readonly createPool:(config:pg.PoolConfig)=>pg.Pool = config=>new Pool(config)) {
    this.configurePool();
  }

  private configurePool(overrideUrl?: string) {
    const rawConnStr = (
      overrideUrl ||
      process.env.DATABASE_URL ||
      process.env.DIRECT_URL ||
      process.env.SUPABASE_DB_URL ||
      process.env.POSTGRES_URL ||
      ''
    ).trim();

    if (rawConnStr && (rawConnStr.startsWith('postgres://') || rawConnStr.startsWith('postgresql://'))) {
      try {
        const pool = this.createPool({
          ...secureDatabaseOptions(rawConnStr,process.env,p=>fs.readFileSync(p,'utf8')),
          max:15,idleTimeoutMillis:30000
        });

        this.pool = pool;
        this.poolGeneration++;
        pool.on('error', (err) => {
          if(this.pool!==pool)return;
          console.error('[POSTGRES POOL ERROR]', {category:classifyPostgresError(err)});
          this.healthGeneration++;
          this.isConnected = false;
          this.connectionError = 'POSTGRES_UNAVAILABLE';
        });
      } catch (err: unknown) {
        rethrowProgrammingError(err);
        console.warn('[POSTGRES INIT ERROR]', 'CONFIGURATION_REJECTED');
        this.connectionError = 'POSTGRES_UNAVAILABLE';
      }
    }
  }

  /** Start each drain once and immediately attach a rejection handler. */
  private drain(pool: pg.Pool): Promise<void> {
    const existing = this.drains.get(pool);
    if (existing) return existing;
    const ending = Promise.resolve().then(() => pool.end());
    this.drains.set(pool, ending);
    this.pendingDrains.add(ending);
    void ending.then(() => { this.pendingDrains.delete(ending); }, () => {});
    // The original rejection remains visible to close()/initialization callers.
    void ending.catch(() => {
      this.drainFailed = true;
      console.warn('[POSTGRES CLEANUP FAILED]', 'POOL_DRAIN_FAILED');
    });
    return ending;
  }

  public close(): Promise<void> {
    if (this.closing) return this.closing;
    const pool = this.pool;
    this.poolGeneration++;
    this.healthGeneration++;
    this.pool = null;
    this.isConnected = false;
    this.isInitialized = false;
    this.initializing = undefined;
    this.probing = undefined;
    if (pool) this.drain(pool);
    const closing = Promise.all([...this.pendingDrains]).then(() => undefined);
    this.closing = closing;
    void closing.then(() => { if (this.closing === closing) this.closing = undefined; },
      () => { /* Retain failed shutdown; do not reopen after a failed drain. */ });
    return closing;
  }

  /** Read-only, coalesced probe; a pool error or replacement invalidates its result. */
  public probeReadiness(): Promise<boolean> {
    if (this.closing || this.initializing || !this.pool) return Promise.resolve(false);
    if (this.probing) return this.probing;
    const pool = this.pool;
    const health = this.healthGeneration;
    const current = (async () => {
      let client: pg.PoolClient | undefined;
      try {
        client = await pool.connect();
        await client.query('SELECT 1');
        await this.verifySchemaReadiness(client);
        if (this.pool !== pool || this.healthGeneration !== health) return false;
        this.isConnected = true;
        this.connectionError = null;
        return true;
      } catch (error) {
        if (this.pool === pool && this.healthGeneration === health) {
          this.isConnected = false;
          this.connectionError = 'POSTGRES_UNAVAILABLE';
        }
        rethrowProgrammingError(error);
        return false;
      } finally { client?.release(); }
    })();
    this.probing = current;
    void current.then(() => { if (this.probing === current) this.probing = undefined; },
      () => { if (this.probing === current) this.probing = undefined; });
    return current;
  }

  public initialize(options?: { skipSchemaCheck?: boolean }): Promise<{ success: boolean; mode: 'REMOTE_POSTGRES' | 'POSTGRES_DISCONNECTED'; error?: string }> {
    if (this.closing || this.drainFailed) return Promise.resolve({success:false, mode:'POSTGRES_DISCONNECTED', error:'POSTGRES_UNAVAILABLE'});
    if (this.initializing) return this.initializing;
    // Invalidate probes already in flight, including probes on the same pool.
    this.healthGeneration++;
    this.isConnected = false;
    this.isInitialized = false;
    this.probing = undefined;
    const current = this.initializePools(options);
    this.initializing = current;
    void current.then(() => { if (this.initializing === current) this.initializing = undefined; },
      () => { if (this.initializing === current) this.initializing = undefined; });
    return current;
  }

  private async initializePools(options?: { skipSchemaCheck?: boolean }): Promise<{ success: boolean; mode: 'REMOTE_POSTGRES' | 'POSTGRES_DISCONNECTED'; error?: string }> {
    const failed = {success:false as const, mode:'POSTGRES_DISCONNECTED' as const, error:'POSTGRES_UNAVAILABLE'};
    if (!this.pool) this.configurePool();
    const generation = this.poolGeneration;
    let pool = this.pool;
    const directUrl = process.env.DIRECT_URL?.trim();
    const primaryUrl = (process.env.DATABASE_URL || process.env.DIRECT_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL || '').trim();
    for (let attempt = 0; pool && attempt < 2; attempt++) {
      const activePool = pool;
      const health = this.healthGeneration;
      let client: pg.PoolClient | undefined;
      let failure: unknown;
      let verified = false;
      try {
        client = await activePool.connect();
        await client.query('SELECT 1 as health');
        if (process.env.NODE_ENV === 'production' || !options?.skipSchemaCheck) await this.verifySchemaReadiness(client);
        verified = true;
      } catch (error) { rethrowProgrammingError(error); failure = error; }
      finally { client?.release(); }
      if (this.pool !== activePool || this.healthGeneration !== health) return failed;
      if (verified) {
        this.isConnected = true;
        this.connectionError = null;
        this.isInitialized = true;
        return {success:true, mode:'REMOTE_POSTGRES'};
      }
      this.isConnected = false;
      this.connectionError = 'POSTGRES_UNAVAILABLE';
      console.warn('[POSTGRES CONNECTION FAILED]', classifyPostgresError(failure));
      if (attempt || !directUrl || directUrl === primaryUrl) return failed;
      // Retire the primary before constructing a replacement. Shutdown can invalidate
      // this attempt while drain waits for outstanding clients to release.
      this.pool = null;
      try { await this.drain(activePool); }
      catch { return failed; }
      if (this.poolGeneration !== generation || this.closing) return failed;
      this.configurePool(directUrl);
      pool = this.pool;
    }
    return failed;
  }

  /**
   * Read-only schema readiness check.
   * Strictly verifies that all authoritative financial tables exist in PostgreSQL
   * without mutating the database schema at startup or during normal operation.
   */
  public async verifySchemaReadiness(client: pg.PoolClient): Promise<void> {
    const requiredTables = [
      'commercial_quote_requests',
      'customer_intelligence_leads',
      'gpu_hunter_opportunities',
      'preapproved_workload_evidence',
      'commercial_verification',
      'commercial_quote_evidence',
      'commercial_evidence_audit',
      'schema_migrations',
      'customers',
      'customer_api_keys',
      'customer_sessions',
      'demand_orders',
      'webhook_events',
      'treasury_accounts',
      'treasury_ledger',
      'treasury_transactions',
      'treasury_snapshots',
      'treasury_reconciliations',
      'quotes',
      'capital_reservations',
      'provider_operations',
      'provider_instances',
      'compute_jobs',
      'settlements',
      'outbox_events',
      'audit_events',
      'idempotency_keys',
      'reconciliation_runs',
      'kill_switch_state',
      'payment_intents',
      'provider_transactions',
      'worker_heartbeats',
      'circuit_breaker_state',
      'profit_withdrawals_audit',
      'verified_profit_records',
      'withdrawal_allowlist',
      'provider_funding_events',
      'autonomous_profit_allocations',
      'hot_wallet_transactions',
      'hot_wallet_idempotency',
      'hot_wallet_nonce_state',
      'hot_wallet_emergency_state',
      'market_opportunities'
    ];

    const tableCheckRes = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [requiredTables]
    );
    const existingTableNames = new Set(tableCheckRes.rows.map((r: any) => r.table_name));
    for (const reqTable of requiredTables) {
      if (!existingTableNames.has(reqTable)) {
        throw new Error(
          `CRITICAL_SCHEMA_ERROR: Required authoritative table '${reqTable}' is missing. Run 'npm run db:migrate' to apply versioned PostgreSQL migrations before starting LIVE operations.`
        );
      }
    }

    await this.verifyMigrationChecksums(client);
    if(process.env.NODE_ENV==='production') {
      await verifyCommercialColumnTypes(client);
      await client.query('SELECT id,title,source_url,source_feed,description,published_at,discovered_at,status FROM acquisition_leads LIMIT 0');
      // Verify the same projections the commercial adapters require, before serving traffic.
      await client.query('SELECT id,created_at,company,contact_name,email,workload,gpu_model,gpu_count,hours,notes,status FROM commercial_quote_requests LIMIT 0');
      await client.query('SELECT id,company,source_url,evidence,workload,contact_channel,estimated_gpu_count,verified_customer,status,created_at FROM customer_intelligence_leads LIMIT 0');
      await client.query('SELECT id,company,source_url,evidence,workload,contact_channel,deadline,budget_evidence,score,score_reasons,status,created_at FROM gpu_hunter_opportunities LIMIT 0');
      await client.query('SELECT id,customer_name,customer_email,workload_description,evidence_type,evidence_sha256,document_reference,issuer_name,issuer_contact,budget_currency,approved_budget,valid_until,state,reviewer,verification_notes,verified_at,created_at FROM preapproved_workload_evidence LIMIT 0');
    }
  }

  /**
   * Read-only Migration Checksum Integrity Verification.
   * Ensures every versioned SQL migration in `supabase/migrations/` is recorded in
   * `schema_migrations` and that `stored checksum === current file checksum`.
   * Throws `MIGRATION_INTEGRITY_FAILURE` if any applied migration file was modified.
   */
  public async verifyMigrationChecksums(
    clientOverride?: pg.PoolClient,
    migrationsDirOverride?: string
  ): Promise<{ verified: boolean; count: number; versions: string[] }> {
    const migrationsDir = migrationsDirOverride || path.join(process.cwd(), 'supabase', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      throw new Error('MIGRATION_INTEGRITY_FAILURE: supabase/migrations directory is missing.');
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const queryFn = clientOverride
      ? (sql: string, params: any[] = []) => clientOverride.query(sql, params)
      : (sql: string, params: any[] = []) => this.query(sql, params);

    const existingRes = await queryFn('SELECT version, checksum FROM schema_migrations');
    const storedMap = new Map<string, string>();
    for (const row of existingRes.rows) {
      storedMap.set(String(row.version).trim(), String(row.checksum).trim());
    }

    const verifiedVersions: string[] = [];
    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      const currentChecksum = crypto.createHash('sha256').update(sql.trim()).digest('hex');

      const storedChecksum = storedMap.get(version);
      if (!storedChecksum) {
        throw new Error(
          `MIGRATION_INTEGRITY_FAILURE: Versioned migration '${version}' has not been applied to PostgreSQL. Run 'npm run db:migrate' before starting LIVE operations.`
        );
      }
      if (storedChecksum !== currentChecksum) {
        throw new Error(
          `MIGRATION_INTEGRITY_FAILURE: Applied financial migration '${version}' checksum mismatch! Stored checksum (${storedChecksum}) !== current file checksum (${currentChecksum}). Startup/deployment refused.`
        );
      }
      verifiedVersions.push(version);
    }

    return {
      verified: true,
      count: verifiedVersions.length,
      versions: verifiedVersions
    };
  }

  public getStatus(): { isConnected: boolean; error: string | null; mode: string; liveExecutionAllowed: boolean } {
    return {
      isConnected: this.isConnected,
      error: this.connectionError,
      mode: this.isConnected ? 'POSTGRESQL_LIVE' : 'POSTGRES_DISCONNECTED',
      liveExecutionAllowed: this.assertLiveModeAllowed().allowed
    };
  }

  public isLiveDatabaseConnected(): boolean {
    return this.isConnected && this.pool !== null;
  }

  /**
   * Fail-Closed Outage Test Probe:
   * Temporarily switches database connectivity flag to simulate an authoritative database drop,
   * proves that assertLiveModeAllowed() strictly rejects execution with fail-closed reason,
   * then safely restores previous connection state.
   */
  public simulateOutageVerification(): { failClosedEnforced: boolean; reason: string } {
    const originalConnected = this.isConnected;
    try {
      this.isConnected = false;
      const check = this.assertLiveModeAllowed();
      const failClosedEnforced =
        check.allowed === false &&
        typeof check.reason === 'string' &&
        (
          check.reason.includes('LIVE MODE BLOCKED') ||
          check.reason.includes('SIMULATION_LOCKDOWN:')
        );
      return {
        failClosedEnforced,
        reason: check.reason || ''
      };
    } finally {
      this.isConnected = originalConnected;
    }
  }

  /**
   * Production Safety Requirement:
   * If PostgreSQL is unavailable, LIVE financial execution is strictly disabled.
   */
  public assertLiveModeAllowed(): { allowed: boolean; reason?: string } {
    if (!liveOperationsAllowed()) {
      return {
        allowed: false,
        reason: 'SIMULATION_LOCKDOWN: Live execution is disabled.'
      };
    }
    if (!this.isConnected || !this.pool) {
      return {
        allowed: false,
        reason: 'LIVE MODE BLOCKED: Authoritative PostgreSQL database is not connected. All live financial operations are strictly disabled.'
      };
    }
    return { allowed: true };
  }

  /**
   * Advisory lock on treasury for concurrency serialization
   */
  public async acquireTreasuryLock(client: pg.PoolClient): Promise<void> {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('arbitrage_treasury_capital_mutex'))`);
  }

  public async query(sql: string, params: any[] = []): Promise<pg.QueryResult<any>> {
    if (!this.pool || !this.isConnected) {
      throw new Error('DATABASE_UNAVAILABLE: PostgreSQL is not connected. Live financial query refused.');
    }
    return this.pool.query(sql, params);
  }

  public async getClient(): Promise<pg.PoolClient> {
    if (!this.pool || !this.isConnected) {
      throw new Error('DATABASE_UNAVAILABLE: Cannot acquire transaction client. PostgreSQL is offline.');
    }
    const pool = this.pool;
    const client = await pool.connect();
    if (this.pool !== pool || !this.isConnected) {
      client.release();
      throw new Error('DATABASE_UNAVAILABLE: Transaction client acquisition was superseded.');
    }
    return client;
  }

  public async recordTreasuryDeposit(deposit: {
    transactionId: string;
    provider: string;
    amount: number;
    currency: string;
    settlementStatus: string;
    treasuryReference?: string;
    accountDestination?: string;
    rawPayload: any;
  }): Promise<void> {
    if (!this.pool || !this.isConnected) return;
    await this.query(
      `INSERT INTO webhook_events (provider, event_id, amount, currency, processed_at, raw_payload)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       ON CONFLICT (provider, event_id) DO NOTHING`,
      [deposit.provider, deposit.transactionId, deposit.amount, deposit.currency, JSON.stringify(deposit.rawPayload)]
    );
  }
}

export const pgDbService = new PostgresDatabaseService();
