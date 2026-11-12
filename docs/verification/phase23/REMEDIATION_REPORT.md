# Phase 23 engineering remediation report

**Verdict: BLOCKED / NO-GO for release.** Safe code repairs, a forward-only migration proposal, isolated schema/restore tests and four release documents are prepared. Production remains unchanged. Missing app/database binding, actual TLS/environment/rotation attestations, backup continuity, approved schema execution/deployment and five commercial gates prevent a production-ready verdict.

## Source and scope

Reference is draft PR #52 and commit 378f5ece74b5a5567cb63e71b6c12af4dde55bda. Started from a clean worktree at that commit; isolated branch remediation/phase23-database-readiness. Core fix commit: 4a6bdfe786ced4464e5d31b610d50b418f0bf40d. Additional verified-TLS/recovery tests: 17545c82430ed8e714bd71de3bf0055ff36d8d7d. Draft PR #53 contains this reviewed lineage. The preceding LIVE_VERIFICATION.md was located/read. User's confirmed Steyn’s workspace was reused explicitly for SELECT-only metadata reads. No merge/deploy, Render branch/env/network/role change, production migration/DDL, production data export, credential rotation, financial activation, paid provisioning or outreach occurred.

Historical migration files under supabase/migrations are unchanged. New proposal is outside automatic registration. Existing Phase22 backend-artifact and authoritative TLS/pool fixes are retained. DISCOVERY_ONLY, owner RBAC, financialLockdown and engaged emergency latch remain; direct invoice mutation calls now also reject through the unconditional execution gate.

## Confirmed defects, root causes and repairs

| Severity | Evidence/root cause at reference | Proposed repair and regression |
|---|---|---|
| High | Nine legacy modules constructed independent Pools, several bypassing verified TLS based on host shape or accepting URL overrides, with separate lifecycle/connection budgets and no authoritative fallback. See source diff for buyerEvidenceImport, commercialEvidence, commercialIntake, customerIntelligence, gpuHunterX, leadDiscovery, ownerOperations, preapprovedWorkloads, usdtInvoiceLedger. | New server/applicationDatabase.ts routes all nine through pgDbService, whose secureDatabaseOptions/fallback/readiness/cleanup is already audited. One runtime Pool boundary remains; unit HTTP/shared outage/source boundary and 38 TLS/lifecycle/diagnostic regressions verify policy adoption. |
| High | Five modules issued runtime schema DDL: CREATEs in commercialIntake/customerIntelligence/gpuHunterX/preapprovedWorkloads/usdtInvoiceLedger, additional acquisition ALTER on a read-only qualification route and invoice CREATE INDEX. | Replace DDL with SELECT LIMIT 0 checks and share authoritative readiness; missing tables return unavailable. No optional storage is silently auto-provisioned. The owner must attest those preexisting tables or review separate explicit migrations. Tests ensure successful/failing owner-route reads issue SELECTs only and no runtime server source constructs schema. |
| High | Direct invoice creation/reconciliation lacked their own permanent release execution guard, relying on HTTP middleware. Direct callers could reach DB/provider operations. | Both mutation functions call assertLiveOperationsAllowed before any wallet, database or RPC work. Regression verifies denial with zero SQL. Financial activation is not implemented. |
| Medium | Migration CLI used app startup with skipSchemaCheck, but production correctly refuses that bypass; a missing required column could prevent the offline path meant to repair it. It also loaded app bootstrap in validation-only mode. | A dedicated offline Client is created only after explicit execute and target-confirmation gates. No app bootstrap or fallback. Actual isolated CLI validation/negative/upgrade tests pass; runtime schema checks remain mandatory. |
| Medium | CLI compared inet_server_addr()::text (network-mask representation) against a host-only expected address, rejecting a correct TCP target. Raw fatal/cleanup errors could expose details. | Use host(inet_server_addr()) / host(inet_client_addr()), retain exact DB/port/transport/address comparison, fixed safe diagnostic codes/categories and client cleanup. Wrong target still rejects; real isolated successful migration verifies correct normalization. |
| High, production prerequisite | Live inspected acquisition table lacks published_at; all nine historical checksums match, showing an unapplied forward schema requirement rather than historical checksum corruption. | New transaction-bound public-qualified proposal adds nullable/no-default timestamptz without backfill or index; guards incompatible baselines/types/defaults/nullability. Twelve isolated TLS/migration/recovery scenarios pass. No production SQL mutation. |
| High, operational | Workspace database is Free and expires 2026-11-27; managed recovery is unavailable for that plan; independent external backup/restore packet absent. | Tested synthetic custom-format dump/restore and concrete recovery plan; actual preservation/restore/plan changes remain separately authorized dependencies. |

These are repairs to demonstrated paths, not a claim that every application or commercial integration is complete. Nondefault historical test/usdtActualLedgerSuite.ts expects live-style positive invoice posting and is not run or presented as certified under the permanent release lockdown; the supported default negative suite now explicitly denies direct mutations.

## Schema, TLS and continuity dossiers

- [MIGRATION_PLAN.md](MIGRATION_PLAN.md): canonical proposal/provenance, complete reference inventory, actual column/default/index findings, nine immutable hashes, ordering, lock budgets, promotion/authorization and forward-only recovery.
- [TLS_SECURITY_REVIEW.md](TLS_SECURITY_REVIEW.md): PR #49 versus hardened policy, all consumers, internal/external trust, CA/URL/fallback precedence, secret-safe errors, pool budget and remaining actual-config evidence.
- [RECOVERY_PLAN.md](RECOVERY_PLAN.md): observed expiry/managed backup eligibility, independent backup gap, executed local dump/restore with exact evidence scope and approval-ready continuity runbook.
- [live-readonly.json](live-readonly.json) and [migration-manifest.json](migration-manifest.json): fresh sanitized metadata/history comparisons; no credentials, connection URLs, customer or financial rows.

## Application configuration and deployed revision

Fresh read-only service metadata confirms the protected service remains on security/phase18-staging-verification and its live deploy is 2482877c3a2221a7eabc5c8da42db67c440268ca, not this candidate. No new deployment was started. The workspace database has the observed acquisition shape, only PK/source-URL indexes and nine matching migration-history rows. Same-workspace/region plus matching schema is not an attested application DATABASE_URL binding. No names-only environment-read tool or managed-backup-list tool is exposed. Actual app binding, primary/direct identity and deployed variable names/values remain unverified; secret values are neither requested nor recorded.

Required names: NODE_ENV, APP_OPERATING_MODE, STRICT_AUTH_ENFORCEMENT, RENDER_GIT_COMMIT, PORT, DATABASE_URL, OWNER_API_KEY, CUSTOMER_API_KEY, ESCROW_SIGNING_SECRET, QUOTE_LOCK_SECRET, AUDIT_CHAIN_SECRET. Require production/DISCOVERY_ONLY/strict profile and exact candidate SHA; distinct strong backend secrets; preview auth off; mutation/paid credentials absent. Optional DIRECT_URL and DATABASE_SSL_CA obey identical transport/privilege policy. Only under explicit narrow private-network acceptance: DATABASE_INTERNAL_TRANSPORT, RENDER_SERVICE_ID, RENDER_INTERNAL_DB_HOST. USDT_DB_SSL no longer creates an independent weaker pool policy. Credentials and trusted-host/CA values must be supplied through approved secret/configuration mechanisms after separate approval, not pasted into this dossier.

**Credential rotation: NOT_VERIFIED.** No independent issue/rotation/revocation timestamps, secret-manager version/audit reference, old-key rejection or new-key least-privilege validation was supplied. Metadata updatedAt, code tests and masked values do not prove rotation. No rotation or session/key invalidation was attempted.

## Verification and failure history

Exact commands, exits, durations and logs are in commands.json. New source files were staged before tracked-file security scanning. Tests run with inherited provider/production DB credentials removed and only platform execution variables retained. Isolated DDL/restore uses its own new local cluster; the production metadata queries are SELECT-only. No system provider/payment credentials or paid services are used.

Retained initial failures: TypeScript exposed an overly broad pg Pool.query type in the shared adapter call; its interface was narrowed to the actual query protocol. A new HTTP fixture requested a nonexistent route and was corrected to the registered /api/approvals/workloads. Source review found a missing PL/pgSQL END semicolon in the draft proposal and corrected it before successful execution. Initial negative tests checked only nonzero exits, so their early PASS labels did not prove the intended scenario; strengthening them to assert exact rejection identifiers exposed the existing inet identity defect masking the checksum scenario. The identity comparison was fixed rather than bypassed, and final negative cases plus successful application/recovery passed. The test harness mock was updated to include real Node argv shape and verify explicit Phase23 dispatch. A deliberately invalid long URL literal triggered the unchanged security scanner; using the short invalid fixture preserves the validation-only test and scanner rule. These attempt logs remain adjacent to final results.

The new Phase23 PostgreSQL suite is wired into the existing offline CI job (not a deploy job). It runs all prior isolated scenarios plus the Phase23 migration/restore child. Full npm test includes the new unit boundary tests, while real database integration remains an explicit isolated command. Hosted outcomes must be read at the exact candidate SHA; local passes do not establish deployment health.

## Production release prerequisites and stop boundary

1. Independent review and successful exact-SHA candidate CI, including the new isolated migration/restore job; owner/security/DBA acceptance of known limitations.
2. Exact service/database and primary/fallback binding, names-only configuration, trusted endpoint/CA/private trust policy, app least privilege and per-replica connection budget attestation.
3. Approved continuity plan and independently verified backup/restore before database expiry; no silent paid upgrade, new cloud resource or production data export.
4. Separately authorized reviewed migration-only artifact, transaction/target/hash/window/backup gates and read-only postchecks; historical files immutable and unknown publication dates remain NULL.
5. Separately authorized rollout/health readiness verification of the exact application artifact. The live backend-artifact exposure remains until a reviewed code deployment; no current fix is claimed deployed.
6. Repository protection/review/check governance, actual credential rotation evidence and all five independent commercial certification packets. Tests or local signatures cannot establish suppliers, capacity, billing cutoff, customers, payments or revenue.

No further code/config/schema workaround is applied to make a blocked release appear green. The plans above are the concrete reviewable result; infrastructure/schema/deployment/credential operations remain outside this task and need their own explicit authorization. Rollback is reviewed branch revert/abandonment or an approved compatible artifact rollback. No production schema/data change needs reversal from this task. Additive columns should be retained after any future approved commit; no destructive down migration, checksum rewrite or automatic restore is provided.

| Exact command | Recorded exit | Result / log |
|---|---|---|
| `npm run typecheck` | 0 | Pass; [verify-00.log](verify-00.log) |
| `npm run lint` | 0 | Pass; [verify-01.log](verify-01.log) |
| `npm run security:check` | 1 | Initial tracked-fixture rejection; final-security.log records corrected exit 0; [verify-02.log](verify-02.log) |
| `npm run test:phase23` | 0 | 5/5 named unit tests; [verify-03.log](verify-03.log) |
| `npm run test:postgres-tls` | 0 | 38/38 named tests; [verify-04.log](verify-04.log) |
| `npm run test:phase20` | 0 | 57/57 named tests; [verify-05.log](verify-05.log) |
| `npm run test:phase21` | 0 | 65/65 named tests; [verify-06.log](verify-06.log) |
| `npm test` | 0 | Complete configured chain; heterogeneous legacy counts retained in log; [verify-07.log](verify-07.log) |
| `npm run test:phase23-postgres` | 0 | Initial Phase23 9/9, final TLS-extended suite 12/12 recorded separately; prior Phase20 14, Phase21 archive 9 and controls 7 scenario groups; cluster stopped; [verify-08.log](verify-08.log) |
| `npm run db:migrate` | 0 | Validation-only; no database connection or DDL; [verify-09.log](verify-09.log) |
| `npm run test:purchase-boundary` | 0 | Pass; [verify-10.log](verify-10.log) |
| `npm run audit:gpu-execution` | 1 | 13 safety controls pass, zero safety failures, five commercial blockers (NO-GO); [verify-11.log](verify-11.log) |
| `npm run build` | 0 | Pass, existing large bundle warning; [verify-12.log](verify-12.log) |
| `git diff HEAD --check` | 0 | Pass; [verify-13.log](verify-13.log) |
| `git diff --cached --check` | 0 | Pass; [verify-14.log](verify-14.log) |
| `npm run security:check` (corrected fixture) | 0 | [final-security.log](final-security.log) |
| `npm audit --json` | 0 | Zero known vulnerabilities; dependency-audit.json |

Fresh optional-table metadata also finds commercial_quote_requests, customer_intelligence_leads, gpu_hunter_opportunities and preapproved_workload_evidence; usdt_customer_invoices is absent in the inspected workspace database. The app does not silently create it and direct invoice mutations remain denied. App-to-database binding is still unverified; this observation does not prove a deployed app role uses the inspected database.

Final targeted results: `npm run test:phase23-postgres` exits 0 with **12/12** named TLS/migration/recovery scenarios and zero skips; `npm run typecheck`, `npm run security:check` and `npm run test:phase23` exit 0 after final test updates. Exact log paths are in supplemental-results.json. The full configured chain, lint and build results above remain valid for the runtime code; hosted CI separately reexecutes the final test changes.

## Hosted candidate verification

At code/test commit **17545c82430ed8e714bd71de3bf0055ff36d8d7d**, both hosted workflows completed successfully: [CI 43222949585](https://github.com/STEYNGROVE/gpu-compute-arbitrage-os-and-connect-it-to-Render./actions/runs/43222949585) and [offline/schema/recovery 43222949577](https://github.com/STEYNGROVE/gpu-compute-arbitrage-os-and-connect-it-to-Render./actions/runs/43222949577). Exact jobs/steps are in hosted-ci.json. Failed/pending jobs: none in that snapshot. Staging: skipped by the manual-dispatch gate, with no staging or deployment action triggered. Later documentation-head checks are visible on draft PR #53 and must not be inferred from an older badge.

Final dossier validation also inspects acquisition-constraints.json (metadata only) and runs tracked-file security/diff/JSON checks after staging all evidence. No runtime code changed after the passing hosted test commit; the final documentation commit is identified by git history and PR #53.
