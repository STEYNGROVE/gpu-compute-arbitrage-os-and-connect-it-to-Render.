# Release, operations and rollback runbook

No deployment authorized. Owner is accountable for release, security, finance and support; appoint qualified independent reviewers where needed. AI prepares changes/evidence and never merges its own PR or commits company funds.

Release checklist:

1. Review exact feature commit, full diff, test evidence, no-secret scan, migration hashes and all remaining blockers. Require CI and independent reviewer; keep draft until accepted.
2. Owner approves discovery-only staging rehearsal separately. Confirm target workspace/service/branch/revision, secrets by names only, strict profile and PostgreSQL CA. Preserve current artifact/settings and obtain backup restoration evidence. Do not alter protected deployment branch.
3. No runtime migrations. Establish compatible schema before rollout through separately approved nonproduction rehearsal; production migrations remain separate approval. Control-lab SQL never belongs in production.
4. Deploy only after explicit authorization. Verify exact live Render commit, health+readiness, anonymous/customer owner-route denial, headers, browser CSP behavior, schema checks and graceful SIGTERM. A live badge alone does not pass readiness.
5. Observe errors/latency/DB pool, verify discovery and zero financial effects. Independent supplier/customer/payment/provider billing certification remains required before a separate financial release. Do not disarm lockdown in this release.

Rollback: owner verifies retained prior artifact, schema compatibility, external effects and restore readiness via rollbackAssessment. Stop rollout on readiness regressions. With explicit authorization roll back application artifact, verify exact restored revision/health/auth and reconcile any nonfinancial writes. Do not run destructive down-migrations, delete financial evidence or assume Render artifact rollback restores DB. Current [Render deployment semantics](https://render.com/docs/deploys.md) inform this process; retrieve the current rollback reference at execution time.

Secret rotation: owner inventories names via approved names-only interface; provision distinct random values in secret storage, never terminal/chat/repo. Rotate owner/customer credentials separately, revoke sessions, validate anonymous/customer denial and approved owner access. Rotate collector public keys using new issuer IDs and overlapping validity windows; revoke compromised keys in reviewed trust configuration and reassess archived receipts. Rotate DB password with controlled connection drain/CA verification and no credential logging. Provider/payment secrets are unnecessary in discovery profile; do not add financial permissions.

Monitoring/alerting: owner checks readiness every minute with existing tools, alert on >2 consecutive 503s, unexpected revision, schema drift, bootstrap failure, DB pool errors, emergency latch inconsistency, receipt/event conflicts or nonzero live financial execution. Review structured events REQUEST_FAILED/BOOTSTRAP_FAILED/RECONCILIATION_REQUIRED and manual queues daily. Proposed thresholds require deployment calibration; no paid alerting integration or claimed 24/7 coverage is installed. Log only codes/digests/revision/duration, never raw provider payloads or PII.

Incident response: owner incident commander timestamps incident, retains immutable evidence, engages emergency latch, stops new work and investigates affected identities/exposure. Do not automatically cancel real resources or refund money. Escalate unknown/still-billing resources immediately to owner; retain full potential cost until final invoice/storage/network evidence resolves. Rotate compromised credentials and obtain qualified privacy/legal advice for notification. Restore only through approved recovery, then review root cause and regression tests before restart.

Disaster recovery: inventory encrypted off-service backups, trusted checksums, ownership and retention. Restore into isolated nonproduction first, verify schema/history, counts, ledger sum/replay and receipt hashes. Disposable pg_dump/restore in this branch is a lab proof only; actual production backup availability/RPO/RTO remain unknown. Proposed discovery RPO 24h/RTO 4h are targets awaiting owner approval. A financial RPO must be defined with banking/payment reconciliation before live launch.

| Operational role | Accountable | Escalation/approval |
| --- | --- | --- |
| Release and infrastructure | Owner | Independent engineering reviewer; deployment separately approved |
| DB migration/restore | Owner/appointed DBA | Explicit schema/restore authorization; accountant verifies financial continuity |
| Security/privacy incident | Owner | Security reviewer and POPIA counsel |
| Pricing/finance | Owner | Accountant; no AI spending authority |
| Contracts/customer support | Owner | Counsel/customer authorized signatory |
| Supplier cancellation/billing | Owner | Separate provider action authorization; final invoice review |
