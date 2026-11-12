# Phase 24 database preflight

Decision: **NO-GO for production migration or application rollout.** Metadata-only SELECTs were authorized; production SQL mutations were not. See [live-readonly.json](live-readonly.json) and [migration-checksums.json](migration-checksums.json).

## Schema and ordering

The original acquisition table shape comes from deployed commit 2482877c3a2221a7eabc5c8da42db67c440268ca, server/leadDiscovery.ts:92. The registered historical migrations do not define it. The inspected live public table has seven columns: id/title/source_url/source_feed text NOT NULL without defaults; discovered_at timestamptz NOT NULL DEFAULT now(); status text NOT NULL DEFAULT CANDIDATE; description text nullable without default. published_at is absent. Prior Phase 23 metadata records PK(id), UNIQUE(source_url) and the four-state status CHECK; Phase 24 tests recreate that metadata shape with synthetic rows. This is not a full production schema/data snapshot or role/extension restore certification.

Forward proposal: [20261112_phase23_acquisition_publication.sql](../../migration-proposals/20261112_phase23_acquisition_publication.sql):4, trimmed SHA256 **7878d7eaeee23f4dfd611e5fb13675570d0c3316e0373e7235901ca4bf09d498**. It remains outside supabase/migrations and will NOT be applied by the current runner. It adds description if absent and published_at as nullable timestamptz, without default, backfill, conversion or new index. Publication time is source evidence, never discovery/upgrade time. Existing unknown publication dates stay NULL. Current queries do not justify an index on published_at; assess actual workload before proposing one.

All nine registered file hashes match the fresh stored history, with no unknown history rows. Lexicographic ordering is preserved and those files are unchanged from Phase 23. Full hashes are in migration-checksums.json. The separate older docs/migration-proposals/20261112_phase19_1_acquisition_publication.sql:3 overlaps this proposal and lacks its baseline guards/public qualification. Neither is automatically registered. Select the Phase 23 guarded proposal for this existing baseline; do not promote both. Phase 20/21 simulation proposals are also unregistered and are not prerequisites for discovery-only release. A new database needs a separately reviewed full bootstrap; this narrow repair and the runner deliberately refuse to bootstrap it.

## Transaction and backward compatibility evidence

[scripts/migrateDatabase.ts](../../../scripts/migrateDatabase.ts):101 defaults to validation-only with no connection. Execution requires the explicit execute marker, matching target confirmations, expected database/port/transport and TCP server address. Identity checks precede the bounded advisory lock and any DDL. History must be a matching known prefix. The dedicated Client uses the same secure transport function and has no DIRECT_URL fallback. Each migration plus its history INSERT is enclosed in one transaction (line 300); failures roll back. The proposal uses SET LOCAL lock_timeout 5s and statement_timeout 30s; connection timeout is 5s and client query timeout is 35s. An ACCESS EXCLUSIVE table lock is still required by ADD COLUMN. Do not retry blindly during traffic or an unknown commit outcome; reconcile history/column policy first.

[test/phase23DatabaseRemediation.ts](../../../test/phase23DatabaseRemediation.ts):82 adds Phase 24 checks to the existing disposable integration harness:

- Apply inside BEGIN, then ROLLBACK: no published_at and no row changes remain.
- Apply/commit/rerun records one exact hash; no default or fabricated dates; incompatible types/defaults/NOT NULL fail without coercion; blocked readers yield bounded lock failure.
- Actual deployed legacy INSERT/ON CONFLICT, SELECT and status UPDATE SQL shapes still execute after upgrade. An old writer leaves publication NULL; legacy readers can read dated rows. Index and constraint definitions survive rerun.
- A shadow acquisition table on search_path is not modified by the public-qualified proposal.
- Verified CA/IP TLS succeeds; unknown CA and mismatching identity fail. A custom-format fixture backup restores into a different new local database and preserves rows, NULLs and history.

Result: **15/15** migration/TLS/recovery scenarios, zero failed/skipped; broader Phase 20 14, Phase 21 9 and control 7 groups also pass. Exact command `npm run test:phase23-postgres`, exit 0, [verify-08.log](verify-08.log). Old SQL compatibility does not certify the complete old binary, production roles, all optional schemas, triggers/extensions or restored customer data. The old deployed binary has known security defects and is not an approved rollback target merely because its SQL is compatible.

## Production gates — not executed

1. DBA/security owner attest exact service-to-database binding, endpoint/CA or private-network acceptance, least-privilege runtime role and separate migration role. Stop if identity differs or database is near expiry.
2. Independently verify a recent encrypted backup, hash, schema/history inventory, retention/key custody and a complete isolated restoration. Agree RPO/RTO and outage window; synthetic fixtures are insufficient.
3. Approve one immutable migration-only artifact with the nine matching historical files plus only the unchanged guarded proposal, ordered last. Approve hash, target identity, window and operator. Do not put execution markers in application/Render startup configuration.
4. Immediately before execution, SELECT-only check availability/read-only posture, database identity, version, table/column/index/constraint definitions, migration prefix and checksums, privileges, connections and blockers. Use secret-safe output, never paste a URL. A changed baseline, extra history or incompatible column policy stops the change.
5. Under a separate authorization only, execute through the reviewed offline runner with one transaction and bounded locks. No production execution command has been run here.
6. SELECT-only postchecks must confirm one matching history row, nullable/no-default timestamptz, preserved counts/NULL history and index/constraint definitions, no stale migration lock, old/new reader compatibility and healthy exact-SHA candidate readiness. Review before any rollout.

## Finding DB-01

Severity: **High**. Evidence: fresh metadata publication_columns=0; server/pgDatabase.ts:225 and server/leadDiscovery.ts:63 require the field. Root cause: acquisition was historically managed outside the registered baseline; the forward requirement remains unapplied. Remediation: reviewed additive proposal and migration-only promotion/approval gates above. Test result: 15/15 isolated scenarios, nine live metadata checksums match. Residual risk: app binding and full production-baseline restoration are unverified; startup will fail closed if pointed at this table. Release decision: **BLOCKED**, no schema bypass.

## Recovery/rollback gates

Before COMMIT, rollback leaves the prior schema intact (tested). After COMMIT, keep the additive columns and history; do not DROP columns, rewrite historical checksums or delete migration history. If a compatible approved app must be restored, retain the schema and verify its auth/TLS/artifact security first. If integrity/data loss occurs, stop writes, preserve evidence and restore the independently validated backup into an isolated new target, validate, then request separate cutover authorization. This task made no production change requiring rollback.
