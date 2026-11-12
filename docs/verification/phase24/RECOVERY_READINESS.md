# Phase 24 recovery readiness

Decision: **NO-GO**. Synthetic restoration is tested; actual production preservation, restore capacity, RPO/RTO and app/database binding remain unverified. No production data export, restore, billing change or cloud resource creation occurred.

## Finding REC-01 — expiry and unproven recoverability

Severity: **Critical release gate (prospective data-loss risk)**. Evidence: fresh Render metadata reports database available, Free, PostgreSQL 18, Ohio, no HA or read replicas, expires **2026-11-27T17:21:10.507676Z** ([live-readonly.json](live-readonly.json)). Root cause: time-limited database plan and no independently verified off-service backup/restore packet. Remediation: owner-approved preservation and continuity before expiry, with complete isolated restoration and custody evidence. Test result: custom-format synthetic backup/restore passed with two fixture rows and matching schema/history; no production restoration tested. Residual risk: full application database inaccessible at expiry, eventual unrecoverable data loss if no independent backup; actual app binding still unverified. Release decision: **BLOCKED**.

Render states that an expired Free database becomes inaccessible; after a 14-day upgrade grace period, the database and data are deleted. Free database recovery is not provided. These are provider policies, not an observed future event. The approximate policy-derived end of grace is **December 11, 2026**, not an independently attested deletion timestamp; verify the Dashboard/support deadline and preserve data before November 27. [Free limits](https://render.com/docs/free), [recovery/exports](https://render.com/docs/postgresql-backups).

If the app is bound to this database, readiness and authoritative operations will fail; discovery persistence and stored customer/evidence/audit records become inaccessible. A running HTTP server/static page does not imply working persistence. Permanent financial denial must remain through outage/recovery. Data on an expired/deleted instance must not be described as retained indefinitely. The separate public allow-all network/privilege risks recorded in Phase 23 require review, not an unauthorized network/role change here.

## Evidence inventory

| Evidence | Status and limit |
|---|---|
| Current plan/expiry/availability/HA metadata | Observed read-only; availability is a point-in-time fact |
| Managed backup/PITR inventory | No inventory tool exposed; Free plan is ineligible under published policy |
| Independent production backup archive, recent checksum, timestamp and encryption/key custody | NOT_VERIFIED; no production dump created or downloaded |
| Production-baseline restoration including roles/extensions/full data | NOT_VERIFIED |
| Actual app-to-database binding and recovery cutover target | NOT_VERIFIED |
| Isolated synthetic dump/restore | PASS; two synthetic acquisition rows plus fixture migration history |
| Credential rotation and old-key revocation | NOT_VERIFIED |
| Cost, ownership, storage capacity, retention and recovery operator acceptance | NOT_VERIFIED |

## Executed isolated rehearsal

`npm run test:phase23-postgres` exits 0; [verify-08.log](verify-08.log) records 15 migration/TLS/recovery scenarios plus prior integration groups. The harness creates and stops only its own loopback cluster and unique databases. It refuses Render/production execution, never uses inherited DATABASE_URL, uses randomized local-only credentials and verifies incorrect TCP passwords are rejected. pg_dump and pg_restore use verify-full with the fixture CA. A custom archive is created mode 0600 and restored into a different empty local database; rows, NULL dates, timestamp equality, source history checksums and new-schema reads match. The disposable archive is removed; cluster artifacts are local synthetic test artifacts only.

Observed archive: 4,598 bytes, SHA256 c4394363ba8681bf8d75580dbbd19fb7438a5089c3df0ba5121b3af51086a62c, measured dump/restore/check interval 415ms, two fixture rows. This measures a tiny local fixture, not a production recovery-time or recovery-point objective. Full roles/grants/extensions, all tables, large-data performance, provider retention and operating recovery are not certified.

## Approval-ready recovery procedure — not executed on production

1. Confirm the precise bound database/service/role and owner; agree deadline, RPO/RTO, data handling, scope, independent storage and authorized operator. Stop if unknown. No production connection string in shell history, reports or process arguments.
2. After separate export authorization, use approved secret injection and authenticated TLS for read-only consistent logical export from the verified target. Include complete schema/data/history and separately reviewed role/extension metadata. Encrypt before transfer to an existing approved off-service durable location; use private file permissions and independently held recovery keys. Record archive hash, UTC snapshot time, database/version identity, retention and operator evidence without row contents or secrets.
3. Restore only to a new empty isolated target of compatible PostgreSQL version, with no paid resources unless separately authorized. Restore with exit-on-error and reviewed ownership/grants mapping. Never use a destructive restore command against the live target.
4. Verify archive hash, complete schema/constraints/indexes/history checksums, row-count/control totals, NULL publication preservation, role isolation and application read-only compatibility. Do not post payments, provision GPUs or replay external side effects. Capture real duration, accepted RPO/RTO and independent reviewer signature.
5. If the approved forward migration is required, test it on that restoration with exact hashes/identity, transactional lock budgets and old/new application compatibility. Any failed check stops release.
6. Only after separate cutover authorization, bind the approved application to the validated target and verify exact artifact SHA, TLS, readiness, emergency latch and owner RBAC. No cutover is performed by this dossier. Preserve source/archive and avoid deleting any existing database until acceptance/retention rules permit it.

## No-cost option, conditional

A read-only logical export to **existing owner-controlled durable encrypted storage**, followed by restoration to an **existing owner-controlled PostgreSQL machine**, can preserve data without new provider charges. This is feasible only if capacity, security, key custody, version compatibility, ownership and authorization are confirmed; none is inferred from the local fixture. It does not establish a publicly reachable highly available Render service. Free web-service local files are ephemeral and unsuitable as the only backup. Rotating through expiring free databases is not a reliable continuity guarantee. No paid upgrade or new resource was created. If no existing approved storage/host is available, no proven zero-cost operating continuity option exists; stop and request separate infrastructure/export authorization.

Rollback from this certification requires only abandoning/reverting the isolated branch. For a future committed additive schema change, retain columns/history and use a reviewed compatible app; for actual data failure, restore into isolation and seek cutover approval. Never silently delete source data, overwrite history, switch endpoints or disable TLS/readiness to recover availability.
