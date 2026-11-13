# PostgreSQL continuity plan — preparation only

Deadline supplied by the operator: **27 November 2026 at 17:21 UTC** (19:21 Johannesburg). Historical API evidence from 12 November records `2026-11-27T17:21:10.507676Z` for `dpg-dbh2u1l9fdbs73a3qpn0-a`. Workspace-confirmed read-only inspection on 13 November, repeated during the PR #59 verification, independently confirms available/free PostgreSQL 18 in Ohio with that exact expiry; see [Render evidence](RENDER_READONLY_EVIDENCE.json). Treat the supplied deadline as binding until independently corrected. On 13 November there are about two weeks; do not rely on any post-expiry grace period. Risk: service outage and potentially irreversible loss of authoritative/audit evidence if preservation is delayed.

No real export, backup, paid upgrade, new database, migration, restore, cutover or deletion is authorized or executed here. The tests only export/restore synthetic loopback fixtures; that does not prove a real backup exists.

## Inventory to establish read-only

| Category | Known or required evidence |
| --- | --- |
| Instance | Exact ID above; historical free/available/Ohio, no HA or replicas; Current metadata confirms the historical plan/status/region/expiry and PostgreSQL major 18; server minor remains unverified. |
| Consumers | Requested staging service `srv-dbmbgrc9v7es739dl3ng`; actual database binding unverified. Historical dossier also references a different service; inventory every application, worker and administrative consumer before cutover. |
| Data | Treasury accounts/ledger/transactions/snapshots/reconciliations; payments, settlements, reservations; provider/job/outbox state; audit/idempotency/profit/withdrawal evidence; customers/API/session data; discovery/acquisition/buyer/commercial metadata. Obtain catalog objects, sizes, row counts and ownership, not sensitive row contents in reports. |
| Schema | All tracked SQL and exact schema_migrations rows/checksums; pending commercial prerequisite/guard and acquisition publication proposal; public and nonpublic schemas, extensions, functions, sequences, triggers, RLS, grants, constraints and indexes. |
| Security | Role privileges, credential custodians, endpoint types, CA/root configuration and rotation, inbound rules, region/account, backup encryption and restore permissions. No secrets in inventory files. |
| Dependencies | Client/server tool compatibility, encoding/locale/collation, timezone, numeric precision, connection capacity and app's 15-connection pool plus other consumers. |

## Preservation and verification after separate authorization

1. Confirm source identity with expected database, role, server address/port, version, service binding and authenticated TLS. Define owner, retention, RPO and RTO. Use an approved read-only export role; never put passwords in shell arguments/history/logs.
2. Produce a consistent custom-format logical export with matching-or-newer compatible pg_dump, including all authorized schema/data, sequences, functions, constraints and migration history. Capture roles/grants/extensions separately under reviewed least privilege. A filesystem copy of an application container is not a PostgreSQL backup.
3. Encrypt into an approved durable off-service destination, private permissions, access/custody controls and independently retained encryption keys. Record UTC snapshot time, archive hash/size, tool/server versions, source identity and inventory counts. Retain more than one independently verified snapshot; establish retention and deletion approval.
4. Inspect archive listing, then restore into a **new isolated empty** database. Never use destructive restore flags on the source or a database containing valuable data. Confirm completion/nonzero failures; verify tables, rows, constraints/indexes/triggers/RLS/sequences, history checksums, ledger sums/status invariants and audit chain continuity. Reconcile in-flight/outbox state without executing provider or payment work. Do not rewrite failed payments as settled or synthetic balances as capital.
5. Rehearse the application against the restored copy with discovery-only flags, financial execution false, no live workers, valid TLS, schema probes and RBAC. Measure duration and recovery point; retain signed evidence. Incompatible pre-existing commercial definitions/history must be resolved through reviewed forward migrations against this copy before any source operation.

## Options requiring approval

- Upgrade the existing Render instance to a suitable paid compute plan before expiry. Verify that the actual instance's expiry is removed; don't assume a workspace-plan upgrade changes the database plan. Review cost, limits, backup/retention and rollback implications before purchase.
- Restore to a new paid managed Render PostgreSQL instance in the appropriate account/region, initially isolated. This preserves a clear original-source rollback target.
- Restore to another approved managed PostgreSQL provider, with reviewed region, compliance, extensions, network, TLS, capacity, operational ownership and cost. A fresh free database with another expiry is not durable continuity.

Selection and spending are not authorized. Render's current docs say free PostgreSQL has no managed recovery or automatic logical backups; independently verified preservation is essential. See [Free instances](https://render.com/docs/free.md) and [Backup/recovery](https://render.com/docs/postgresql-backups.md).

## Target provisioning and recovery objectives (approval required)

Assign a database custodian, independent restore verifier and release approver before execution. Proposed planning targets are RPO no greater than one hour and RTO no greater than four hours; the owner must approve them and the rehearsal must demonstrate them. These are not measured service guarantees or scheduled backup jobs.

After separate provisioning/spending authorization, create an isolated managed target in the approved account/region, preferably matching PostgreSQL major 18 initially. Verify actual source size before sizing, include growth headroom, and match supported extensions, encoding, locale/collation and timezone. Establish separate least-privilege application, migration and backup roles; validate grants and restore ownership without importing unnecessary superuser privileges. Keep public network access restricted to approved clients and require certificate plus hostname verification. Do not attach consumers until restore/integrity review passes. Confirm paid backup retention/PITR and an off-service encrypted export path; do not assume a workspace upgrade changes a database's free plan or expiry. No target is provisioned by this packet.

## Cutover and rollback after separate authorization

1. Approve a change window and tested recovery packet. Freeze relevant writes and drain applications without initiating financial transactions. Take and verify the final consistent snapshot or approved delta; record its cutoff and reconcile new source writes.
2. Restore/validate the replacement, establish least-privilege application credentials and independently verified server identity. Prefer a fully authenticated DNS endpoint, `rejectUnauthorized:true`, maintained public roots or reviewed CA file. Strip URL override parameters; primary/fallback must select the same authorized database. Do not weaken TLS for private-looking endpoints.
3. With explicit environment/release authorization, update only approved consumer bindings, then deploy the approved revision through the existing release process. No auto-migration, deployment-branch changes or financial activation. Recheck revision, TLS, bootstrap/schema/readiness, RBAC, row/ledger/audit invariants and connection capacity.
4. If acceptance fails before writes resume, revert to the retained source only after verifying its health/identity/compatibility and explicit rollback authorization. If the new database accepted writes, freeze both sides and reconcile those writes; an endpoint flip alone loses evidence. Restore the verified archive to a separate instance if the original is expired/unavailable. Never overwrite the only good copy.
5. Retain the original and encrypted archives through the approved retention/acceptance period; deletion requires separate approval. Record custody, RPO/RTO achieved and final invariants.

## Proposed schedule

- **13–16 November:** confirm current expiry and consumers; approve preservation owner, storage and plan.
- **By 20 November:** authorized encrypted export plus independently verified isolated restoration and integrity packet.
- **By 24 November:** approved durable plan/replacement and complete cutover rehearsal; leave days for provider/support issues.
- **Before 27 November 17:21 UTC:** execute only an approved continuity change and confirm expiry removed or consumers moved with verified rollback retention. Escalate immediately if no verified backup/restore packet exists by 20 November.

These are planning milestones, not scheduled jobs or permission to execute them.
