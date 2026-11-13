# Phase 25 local PostgreSQL recovery review

**STAGING VERIFICATION PENDING.** This patch is for code review. Financial execution remains disabled. No push, merge, deployment, Render configuration edit, real migration, payment or financial activation is authorized or performed. In this commit-finalization run, no database migrations or migration harnesses were executed.

## Verified problems and repair

The merged pool fallback could overwrite replacement-pool health after a stale attempt. Initialization was not coalesced, shutdown could miss an outstanding retirement, and a probe could restore health after a newer same-pool error. The repair retains pool-identity checks, adds health generations, coalesces initialization/probes, drains each pool once, observes cleanup rejections, blocks reopening after a failed drain and releases superseded transaction clients. Programming errors propagate; connection and query deadlines remain bounded. Startup and readiness perform read-only schema/history checks.

Four commercial adapters lost runtime table creation in PR #55 without corresponding creating migrations. The existing v5 migration references commercial_quote_requests. New prerequisite SQL supplies those four tables and a later migration protects documentary metadata/audit rows. Shared readiness now checks their columns/types. Migration loading again supports explicit development-only dotenv before its authorization gate; production/tests never load local dotenv. Test execution additionally requires the owning loopback fixture identity.

Production TLS remains authenticated for every endpoint. The former environment/hostname-based plaintext exception is removed; internal-looking names do not establish trust. URL overrides cannot replace verified SSL options. No insecure certificate-verification override or speculative internal exception was introduced.

## Code changes

| Paths | Purpose |
| --- | --- |
| server/pgDatabase.ts | Pool lifecycle, stale-state guards, client release, read-only commercial schema verification. |
| server/commercialSchema.ts | Required commercial column/type contract. |
| server/phase21/configuration.ts | Authenticated production TLS for all endpoints. |
| server/readinessHealth.ts | Recheck current dependency/safety state and distinguish operational readiness from commercial/financial authorization. |
| scripts/migrationEnvironment.ts; scripts/migrateDatabase.ts | Development-only dotenv and explicit migration/test-target gates. |
| supabase/migrations/20261109000002_commercial_intake_prerequisites.sql | Four missing commercial tables, keys, constraints, deduplication and indexes before v5 references. |
| supabase/migrations/20261113000000_commercial_evidence_immutability.sql | One pending review decision, immutable documentary metadata, append-only audit and mutation/TRUNCATE guards. |
| test/postgresLifecycle.test.ts; test/renderPostgresTls.test.ts | Lifecycle races, cleanup/release, TLS policy and downgrade regressions. |
| test/phase25Recovery.test.ts; test/phase25Readiness.test.ts; test/postgresCertificateExpiry.test.ts | Missing/incompatible schema/history, migration authorization, HTTP readiness and actual local certificate verification. |
| test/phase25CommercialPostgres.ts; test/phase23DatabaseRemediation.ts | Disposable commercial integration scenarios and fixture-only final proposal ordering. |
| scripts/test-phase16-postgres.cjs; package.json; .github/workflows/phase18.yml | Regression commands and explicit isolated CI integration harness. |

The complete committed-path inventory is [CHANGED_FILES.json](CHANGED_FILES.json).

## Migration safety assessment

Only two new SQL files are added. Existing applied SQL files/checksums are unchanged. No financial ledger entries are updated. No runtime migration hook, startup DDL, migration gate bypass or automatic data conversion is added. The audit guards resist normal SQL mutation; database owners can still bypass/drop guards, requiring least-privilege role and independent audit-retention review.

The prerequisite sorts before the existing v5 migration. A database that recorded v5 without the new prerequisite has a non-prefix history and is deliberately rejected by the migration runner. Do not edit old checksums, delete history, relax the gate or mark unexecuted SQL applied. Such an instance needs separately reviewed, authorized history recovery following verified backup/restore and inspection of the real schema. IF NOT EXISTS does not repair incompatible existing tables or supply missing old constraints. Validate existing types, numeric precision, defaults, nullability, keys, constraints, triggers and evidence in isolation before any live migration approval. The acquisition published_at change remains a separate proposal and authorization concern.

Rollback requires a compatible application with additive schema retained, or verified restoration into a separate database with explicit cutover approval. Do not drop evidence, overwrite financial ledgers or rewrite history as a rollback shortcut.

## Validation and evidence

[TEST_RESULTS.md](TEST_RESULTS.md) records the fresh offline test commands, exits, counts, skipped groups and durations. Raw logs and superseded reports/ledgers remain local and ignored; none are included in this commit. [POSTGRES_TEST_EVIDENCE.json](POSTGRES_TEST_EVIDENCE.json) retains the prior successful 52-scenario disposable PostgreSQL result and hashes of the unchanged SQL/harness files. That harness was not rerun during finalization, respecting the no-migration restriction.

The known Vite >500 kB warning is a performance concern, not a build failure. The strict commercial audit previously exited 1: all 13 safety controls passed but five explicit commercial integration gates remain unresolved. No code was altered to make that release audit green. Passing local regressions are not commercial certification.

[RENDER_TLS_INVESTIGATION.md](RENDER_TLS_INVESTIGATION.md) and [RENDER_READONLY_EVIDENCE.json](RENDER_READONLY_EVIDENCE.json) establish two failed Phase 25 instances, the failed rollout and a separate older live deployment. They do not establish recovery of the Phase 25 revision. Historical successful CI on the PR head and a skipped live-staging job do not certify this repair.

## Git and security review

The branch is fix/pg-connection-lifecycle-20261113. Its HEAD and freshly fetched origin/main before this local commit equal merged PR #55 commit 83578e61cd9265629d0fda311b41aa5c0904e27c; ancestry is verified. The original pool-identity patch remains preserved in its stash. No unrelated source files were changed. Git author identity is now configured; the user authorized one local commit after passing local tests. No remote action follows from that commit.

The staged source and evidence were reviewed for secret material and unintended changes. Test credentials/keys are synthetic, local TLS private keys are generated in temporary directories, and no private-key bodies, actual passwords, secret environment values or full database URLs are committed. The standard tracked-file security scan and an additional staged-file pattern scan are recorded with the final checks. Provider logs are reduced to relevant sanitized excerpts. Diagnostic categories do not establish an exact TLS error code.

## Remaining release blockers

1. Deployment-matched endpoint category, effective CA/root configuration, runtime CA-file presence/readability and original TLS error.code remain unverified. Accessible logs retain TLS_CERTIFICATE only. Obtain sanitized read-only operator/provider evidence; do not add a bypass. [Exact next action](CURRENT_BLOCKER.md).
2. Review and authorization of real schema/history recovery, acquisition publication compatibility and any migration execution remain outstanding.
3. A fresh authorized CI/release and independently verified staging rollout of the reviewed SHA remain outstanding. The last inspected Phase 25 deployment failed; an older artifact was live.
4. PostgreSQL expiry is confirmed as 27 November 2026 at 17:21:10 UTC. Real preservation, isolated restoration verification and continuity/cutover require separate authorization. [Continuity plan](POSTGRES_CONTINUITY.md).
5. Commercial audit gates remain open: unified purchase boundary, trusted balance evidence, provider termination/reconciliation, complete financial database/concurrency/recovery certification and prepaid payment evidence. Financial execution stays disabled.
