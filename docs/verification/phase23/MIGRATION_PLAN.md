# Phase 23 acquisition publication migration plan

**Prepared, tested locally, not authorized or executed in production.** Source baseline is PR #52 / 378f5ece74b5a5567cb63e71b6c12af4dde55bda. Historical migration files remain byte-for-byte unchanged. Exact hashes and live comparisons are in migration-manifest.json.

## Canonical definition and references

The repository's maintained acquisition schema definition is the unapplied proposal [20261112_phase19_1_acquisition_publication.sql](../../migration-proposals/20261112_phase19_1_acquisition_publication.sql). No acquisition table definition exists in the nine registered supabase migrations. This is a provenance gap: the live base table predates publication support and matches the proposal's base shape, but this does not prove how its original DDL was applied. Do not rewrite an old registered migration to conceal the gap.

[Schema reference inventory](schema-reference-inventory.txt) lists every matching server/script/SQL/test reference collected by rg. Principal consumers are server/leadDiscovery.ts (readiness, insertion, recent-lead selection), server/leadQualification.ts (freshness), server/pgDatabase.ts (production column compatibility) and server/phase21/migrations.ts (type compatibility). The GPU Hunter qualification route previously attempted ALTER TABLE acquisition_leads at request time; that DDL is removed in this change.

Fresh SELECT-only metadata in live-readonly.json confirms seven current columns, two indexes and no published_at. All nine registered history rows match current trimmed SHA-256 files, with no missing or unknown version. This is the inspected workspace database; actual service binding remains unverified.

| Column | Intended definition | Existing live baseline |
|---|---|---|
| id/title/source_url/source_feed | text NOT NULL | Present, no defaults; id PK and source_url UNIQUE |
| discovered_at | timestamptz NOT NULL DEFAULT now() | Present |
| status | text NOT NULL DEFAULT 'CANDIDATE'; four advisory states | Present |
| description | text NULL, no default | Present |
| published_at | timestamptz NULL, no default | Missing |

Unknown publication is NULL, never discovery time, migration time or a fabricated historical date. The application rejects undated records for fresh-review qualification. Current SQL orders recent records by discovered_at and qualifies publication in application code; no published_at index is defined or demonstrated necessary. This migration adds no index, changes no existing index, and makes no speculative performance claim. Existing indexes are acquisition_leads_pkey(id) and acquisition_leads_source_url_key(source_url).

## Forward-only artifact and ordering

New reviewed proposal: [20261112_phase23_acquisition_publication.sql](../../migration-proposals/20261112_phase23_acquisition_publication.sql). It is outside supabase/migrations and is **not automatically registered**. The manifest seals its exact trimmed hash. Its version sorts after the current last registered migration, 20261110_v5_commercial_evidence. Do not apply both old and new acquisition proposals as separate competing migrations; the new proposal supersedes the old acquisition proposal for this remediation only. Unrelated Phase20/21 simulation proposals are not production prerequisites and must not be applied incidentally.

The SQL must run inside one approved transaction. SET LOCAL bounds lock wait at five seconds and server statement time at 30 seconds. Explicit public qualification prevents search-path redirection. It requires an existing compatible base table; an empty database is rejected. Existing description or published_at columns with incompatible types, NOT NULL or non-null defaults are rejected rather than silently converted. Compatible reruns are idempotent. It adds nullable description where historically absent and nullable published_at. There is no backfill, timestamp coercion, UPDATE, DELETE, DROP or new index.

ALTER TABLE still acquires a strong table lock. Nullable/no-default avoids a data backfill, not the lock itself. A blocked-reader scenario is exercised locally and fails within the lock bound without partial schema/history change. Real production table size/traffic/lock duration remain unmeasured. [PostgreSQL ALTER TABLE guidance](https://www.postgresql.org/docs/18/ddl-alter.html) explains the null/no-default semantics.

## Authorized execution procedure — future, not performed

1. Resolve exact app/database binding using approved secret-safe metadata. Reconfirm current revision, endpoint policy, database identity/port/address, nine historical source checksums and the absence/definition of the target columns. Appoint owner/DBA and maintenance window. Stop on drift.
2. Obtain an independently verified backup/restore packet and preserve prior app artifacts. Free database expiry is a separate urgent continuity concern; this migration does not extend it. Rehearse the actual approved baseline in isolated resources before production authority is granted.
3. In a separately reviewed migration-only artifact, copy the sealed new proposal unchanged into supabase/migrations with the same filename after the nine immutable sources. Validate and approve this artifact. This preparation task does not perform that promotion, merge it, or change any deployment branch.
4. By default, npm run db:migrate validates files only, without loading app bootstrap or connecting. Actual execution needs a separate operator process with DB_MIGRATION_EXECUTE=EXPLICITLY_AUTHORIZED, matching DB_MIGRATION_TARGET / DB_MIGRATION_TARGET_CONFIRM, DB_MIGRATION_EXPECT_DATABASE, DB_MIGRATION_EXPECT_PORT, DB_MIGRATION_EXPECT_TRANSPORT, and for TCP DB_MIGRATION_EXPECT_SERVER_ADDRESS. These are process-local inputs for future authorized execution, not changes to the app service's production environment. Keep values out of reports/logs; do not paste credentials.
5. The repaired CLI uses a dedicated authenticated Client after authorization gates, with no fallback. It compares connected database/port/host-normalized server address and transport before advisory lock or DDL. It refuses fresh schema bootstrap, unknown history, drift and non-prefix ordering. It applies SQL plus the exact version/hash in one transaction and closes its client on success/failure. Runtime readiness is not bypassed or made optional.
6. Read-only postchecks: registered history has the reviewed new version/checksum; all historical checksums unchanged; published_at is timestamptz, nullable, default NULL; description is compatible; existing indexes remain. Candidate SELECT LIMIT 0 must succeed. Verify historical unknown dates remain NULL without exporting customer data. Preserve the promoted SQL in any later application artifact so migration history remains reproducible.
7. Any app rollout remains separately authorized. Keep DISCOVERY_ONLY, strict owner RBAC and emergency stop. Do not combine schema work with financial activation, paid provisioning, unrelated proposals or credential rotation.

## Local test evidence and recovery

npm run test:phase23-postgres owns a disposable authenticated loopback cluster. New checks first exercise actual PostgreSQL TLS trust and hostname rejection, then cover validation-only with invalid URL, wrong identity, history drift, wrong publication type, lock contention, correct atomic history registration, rerun, NULL preservation, timezone equivalence, conflicting defaults/NOT NULL and custom-format dump/restore. Tests use synthetic rows; no production data is copied. Counts and exact results are in commands.json and logs.

The runner previously depended on app startup readiness, making a missing required column impossible to repair through that path; its IP identity comparison also used inet::text rather than host(inet). Both are repaired and exercised by actual CLI subprocesses against local databases. Error output uses fixed identifiers/categories, not raw URL/path/server exceptions.

Rollback is transaction rollback before commit. After commit, prefer leaving the additive nullable columns in place and rolling the application artifact back only if separately approved/compatible. No destructive down migration is supplied. Restore of production data requires its own authorization and reconciled recovery procedure; an app rollback does not restore a database. Do not delete the migration-history record or falsify a checksum to force readiness.

The final isolated CLI apply uses production TLS policy with an explicit fixture CA against the generated loopback database only. It does not connect to a production resource. Actual PostgreSQL certificate/hostname tests and the recovery use a one-day locally generated self-signed fixture; no verification bypass is configured.

The per-query/statement and lock bounds are not a promise of total migration duration across all preflight statements. The future operator must approve and monitor an end-to-end window and verify transaction/history state after any timeout or uncertain response; no automatic retry or failover is provided.

Additional SELECT-only constraint metadata is retained in acquisition-constraints.json: the live inspected table has the expected primary key, source-URL uniqueness, NOT NULL base columns and four-state status CHECK. No constraint was modified. The repo-wide published_at inventory (excluding generated verification logs/reports) is published-at-reference-inventory.txt; original runtime creation/removal commit provenance is acquisition-provenance.txt.
