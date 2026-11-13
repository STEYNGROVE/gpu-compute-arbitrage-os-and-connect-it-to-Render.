# Phase 23 database continuity and tested recovery plan

**No production dump, restore, snapshot creation, storage transfer, plan change or paid resource creation occurred.** This plan is prepared for review. Actual production RPO/RTO, external backup existence and restoration readiness remain unverified.

## Verified availability and risks

Fresh Render list metadata in live-readonly.json confirms the inspected workspace database is available, Free-tier, Ohio, PostgreSQL 18, expiry 2026-11-27T17:21:10.507676Z, with no HA/replicas. Application binding remains unverified. A running/available database and matching migration records are not recovery evidence.

[Render's current recovery reference](https://render.com/docs/postgresql-backups.md) says Free databases have no managed recovery capabilities or provider-created logical backups. Paid PITR/exports must not be assumed available for this instance. No backup-list tool is exposed in this connection. No independent off-service dump/storage manifest, retention, key custody, successful restore or accountant/DBA acceptance was supplied. Therefore:

| Evidence | Status |
|---|---|
| Database existence/plan/expiry | Verified by read-only metadata |
| Managed recovery eligibility | Not available for the observed Free plan under provider documentation |
| Independent external backup availability/integrity | NOT_VERIFIED |
| Synthetic local custom-format backup/restore | Executed, passed |
| Production dataset restore, PITR, replica failover | NOT_EXECUTED / NOT_VERIFIED |
| Production RPO/RTO and downtime window | NOT_ESTABLISHED |

Expiry is an urgent continuity prerequisite. Do not create paid resources, upgrade a plan or assume an upgrade will retroactively produce recoverable history. The owner must separately approve a preservation plan before expiry. This task has no authority to export production customer/financial data, grant storage access or make the database externally accessible.

## Executed isolated recovery procedure

Reproducible command: `npm run test:phase23-postgres`. It creates/stops only its own local PostgreSQL cluster through scripts/test-phase16-postgres.cjs. The Phase23 child refuses deployment/production environments, missing isolated opt-in, non-loopback host, unexpected test username/database and URL query parameters. A one-day certificate is generated only in the fixture; private key permissions are 0600 and the cluster supports actual TLS. Generated authentication and PGPASSWORD remain only in the fixture process environment and are never logged.

1. Create unique local source and restore database names under the disposable cluster. Construct a synthetic seven-column acquisition baseline matching observed metadata, nine source-matching migration-history entries, and one undated synthetic row. No live data is copied.
2. Exercise the approved-mode migration CLI in isolation after negative target/hash/schema/lock checks. Apply the forward proposal transactionally, record the exact new checksum once and insert a second fixture with an explicit timezone offset.
3. Run `pg_dump` with custom format, no-owner and explicit PGSSLMODE=verify-full/fixture PGSSLROOTCERT into the test's private temporary directory. The directory is private and dump permissions are 0600. Compute SHA-256 of the archive; inspect the expected archive size, not its sensitive contents.
4. Create a separate empty local restore database and run `pg_restore --no-owner --exit-on-error` against it. Never use `--clean` against a shared database; this rehearsal creates a clean target instead.
5. Compare the complete synthetic row set (including historical NULL dates, timezone-equivalent timestamp, description and discovery time), all migration version/checksum rows, and the exact candidate SELECT LIMIT 0. Fail on any mismatch.
6. Close both clients, drop only the uniquely named fixture databases, delete the synthetic dump/temp artifact, and stop the cluster in finally. Cleanup runs on failure as well. No production connection URL is consumed by the harness.

`PHASE23_RECOVERY` in the executed log records archive hash, byte count, two synthetic rows and elapsed time; these are **small lab measurements, not production RPO/RTO promises**. The surrounding integration also restores simulated ledger/evidence controls from the existing Phase21 suite. It does not certify a complete production financial ledger or source dataset.

## Future approved production preservation/restore runbook

Prerequisites: exact source/application binding, database/version/role/transport identity, data owner and accountable DBA, least-privilege read-only export mechanism, approved encrypted durable destination/retention/key custody, data residency/PII review, backup integrity and restore budget. Do not put connection URLs, passwords or data in shell arguments, repository, chat or logs. Do not run this procedure on production under the present authorization.

After separate explicit approval, an operator should record backup source/revision/schema/history and time; export with the version-appropriate pg_dump client through the approved secret mechanism; encrypt/store the artifact off the source service; retain digest, size, immutable object/version reference and access/retention evidence without contents. A stored filename or a successful pg_dump exit alone is not sufficient.

Restore first into a separately approved isolated target with no production consumers, no provider/payment mutation credentials and no financial workers. Verify PostgreSQL compatibility, roles/ownership/extension requirements, archive hash, schema and migration history, data invariants, expected counts/checksums, application read-only compatibility, RBAC and financial lockdown. Record measured duration, staleness/RPO and independently accepted reconciliation evidence. `--no-owner` in the lab does not recreate production role grants; security grants must be separately reviewed and rehearsed.

No cutover occurs until owner/DBA and applicable finance/security reviewers accept exact source/target binding, restore results, app artifact, TLS/configuration, loss window, reconciliation, rollback and emergency procedure. Updating bindings, service variables or deployment revisions requires separate authorization. Do not overwrite a live source, destroy its evidence or attempt an automatic down migration.

## Failure handling and rollback

Stop on unknown/damaged archive, checksum/history drift, incomplete identity, role/extension mismatch, readiness failure, unresolved financial invariant or unsupported PostgreSQL version. Preserve evidence and keep source/target isolated. Do not make an uncertain restore authoritative or enable financial execution to test it.

The proposed application changes are independently reviewable/revertible on the review branch; schema/data are unchanged in production. A future additive migration can be rolled back transactionally before commit. After commit, retain the nullable publication columns rather than destroy evidence. Restoring or cutting over production is its own approved operation; an application rollback never restores database contents.

Local tool versions for the executed rehearsal: PostgreSQL/pg_dump 18.6, Node v24.22.2 and npm 12.2.1. Backup/restore subprocesses have 30-second lab deadlines; migration subprocesses have 50-second lab deadlines. These are fixture bounds, not approved production operating budgets.
