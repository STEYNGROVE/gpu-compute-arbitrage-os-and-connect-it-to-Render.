# Database continuity and recovery

## Verified in isolation

The candidate adds a prerequisite migration for commercial_quote_requests, customer_intelligence_leads, gpu_hunter_opportunities and preapproved_workload_evidence before the existing v5 FK-dependent migration. It preserves prior migration files/checksums. Definitions restore required types/defaults, PK/unique/status constraints, resource and metadata bounds, indexes, RLS and PUBLIC privilege revocation. Existing incompatible columns fail rather than being coerced or deleted. Runtime readiness now SELECT-probes all four shapes. Independent acquisition publication metadata also becomes a versioned additive migration; historical unknown publication dates remain NULL.

A single named additive prerequisite may be backfilled for a legacy database that already recorded v5. It is still executed and checksummed. This is not a general history waiver: arbitrary holes, changed historical checksums and wrong target identity continue to reject. Fresh bootstrap additionally requires `DB_MIGRATION_FRESH_INSTALL=EXPLICITLY_AUTHORIZED`, all existing execution gates and verified connected database identity. Production was not targeted. Development-only .env loading excludes test, staging, production, Render and CI and imports no application bootstrap.

`npm run test:launch-recovery-postgres` creates and stops a disposable password-authenticated localhost cluster. The new cases exercise complete fresh installation, repeat application, legacy prerequisite adoption, resource constraints, FK/RLS behavior, production readiness queries, incompatible-schema rejection and arbitrary-history-hole rejection. It dumps synthetic rows and restores into another isolated database and compares rows/checksums. Existing tests also cover locks, query timeout/recovery, concurrency, replay, trusted/untrusted/mismatched TLS, migration rollback and NULL publication preservation. See tests.json and the reported PostgreSQL counts. Millisecond fixture restore measurements are not production RTO/RPO commitments.

## Not verified in production

The previously reported expiry, **27 November 2026 around 19:21 SAST**, is a historical lead, not current proof. Render has no selected workspace and owner confirmation is pending. Current database ID, status, expiry, size/growth, plan, backup retention, network exposure, TLS mode, role permissions and applied history are unknown. The original encrypted backup was not opened, decrypted, exported or modified, and its recoverability is not claimed.

Current official Render documentation states that Free PostgreSQL expires after 30 days and lacks managed recovery/logical backups. Free services are unsuitable for production workloads; a succession of expiring free databases is not a sustained continuity plan. Sources checked: https://render.com/docs/free and https://render.com/docs/postgresql-backups . No fee-bearing service was created or upgraded.

## Exact owner actions before sustained launch

1. Confirm the Render workspace, allowing read-only instance/service metadata and the prepared preflight SQL to establish current facts without customer rows or credentials.
2. Approve a durable destination and explicit retention, encryption, access owners and recovery objectives for production backups. Example planning targets are RPO <=24 hours and RTO <=4 hours, **proposed only**, not measured or certified.
3. Approve either an upgrade of the existing PostgreSQL service using its current Dashboard price, or an approved durable replacement with verified retention/availability. No particular plan or free-tier permanence is assumed.
4. Authorize an encrypted production backup to that approved destination and an isolated recovery drill before expiry; do not upload customer data to this workspace or an unapproved service.
5. Review exact migration checksums, connected identity and schema diff; then separately authorize a maintenance window and production execution. Test restoration, final row/constraint/history checks and application readiness before changing service configuration.

No production down-migration or destructive rollback script is provided. Recovery uses a separately validated restore to a new approved instance, or a compatible forward fix. Retain the original database until reconciliation, owner approval and recovery acceptance. No continuity GO is issued until these facts and procedures are independently verified.

The later public readiness probe reports database connectivity from the application at revision c9d9033. This is not proof of database identity, expiry, migration history, recovery capability or continuity. Render metadata remains unavailable pending workspace confirmation.
