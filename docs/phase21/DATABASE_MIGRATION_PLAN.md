# Database migration plan

No production migration executed or authorized. Historical migration files remain unchanged. Source-only planner: `npm run plan:phase21-migrations`. Checksums use trimmed SQL to match the existing migration convention; raw source hashes are separately inventoried. An empty or unknown history is incompatible, never implicitly accepted as a fresh production baseline.

Inventories: baseline-inventory.json and migration-manifest.json include historical schema, payment, reservation, acquisition and simulation proposals. Phase 19.1 acquisition proposal adds publication evidence without inventing historic publication dates; Phase 20 journal is simulation-only. New Phase 21 archive and control-lab proposals are outside runtime migration directories. The control lab must never be applied to production.

Rehearsal implemented: disposable local initdb cluster with random password/unused port; wrong-password check; isolated schema; acquisition and commercial upgrade fixtures; Phase 20 and archive create/reapply/rollback; unique/deferred constraints and eight-way concurrency; ledger rollback/reversal; pg_dump custom archive and restoration into a second disposable database. Exact results appear in TEST_EVIDENCE.md. This is not a restoration of the unknown production baseline or replica recovery.

Operational migration sequence (requires separate authorization):

1. DB owner obtains names/types/constraints/indexes/roles/extensions and version/checksum history via read-only export. Keep credentials and personal data out of reports. Compare against exact app commit and source manifest; stop on drift.
2. DBA takes encrypted backup with retention and checksum; restore into an isolated access-controlled nonproduction database. Verify row counts, financial sums, FK validity, archive hashes and replay idempotency against the trusted source baseline.
3. Review each historical migration for destructive statements; do not replay CREATE/DROP scripts onto an unknown baseline. Reconcile acquisition baseline and unapplied proposals explicitly. Require database owner approval for any new role, extension or DDL.
4. Rehearse upgrade in a transaction with lock_timeout 3s and statement_timeout 5s for proposals; inspect pg_locks and realistic table sizes. Short lab runs do not establish production lock duration. Large constraint/index operations need a staged expand/validate plan and separately reviewed concurrent indexes.
5. Use separate migration-owner credentials. Runtime role gets only required SELECT and narrowly scoped nonfinancial writes; revoke PUBLIC schema creation and financial DML. Archive role INSERT/SELECT only; posting through a reviewed security boundary still needs implementation. No superuser or migration-owner credentials in app runtime.
6. Approve exact manifest and maintenance/forward-recovery plan. Execute only after separate production authorization. Startup remains DDL-free and readiness fails on incompatible schema.
7. Verify migration history, constraints, canary behavior, ledger sums and archive integrity. On failure stop rollout, retain artifacts and assess forward fix; never blindly run down migrations or delete evidence.

Rollback is application-artifact rollback only if prior app remains schema-compatible. Restoring a DB can lose newer events and therefore requires explicit incident authorization, event reconciliation and approved RPO. Proposed launch targets: RPO 24h for discovery, RTO 4h; no financial production SLA exists. Replica lag, physical restart/failover, production retention and realistic restore timing remain unverified.
