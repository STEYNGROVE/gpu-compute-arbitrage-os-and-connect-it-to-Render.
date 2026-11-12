# Phase 22 follow-up — additional remediation and read-only evidence

**Release recommendation remains NO-GO.** The request to “do everything possible” was treated as authorization for the previously proposed read-only production/commercial-evidence review and further supported code repairs. Earlier restrictions remain: no merge/deploy, Render branch/environment change, production migration, credential rotation, paid resource operation or financial execution.

## Additional high-severity finding: public backend artifacts

**Root cause:** package.json builds both frontend output and `server.cjs`/`server.cjs.map` into dist, while the production branch of server.ts served the entire directory with anonymous express.static. Owner API authorization does not protect these root static URLs. Server source disclosure can expose internal implementation and aid attacks; no embedded credential or actual secret disclosure is claimed.

**Evidence:** [public-artifact-head.json](public-artifact-head.json) records anonymous HEAD-only checks against the existing public service: `/server.cjs` returned 200, application/octet-stream, Content-Length 1280298; `/server.cjs.map` returned 200, application/json. Bodies were neither requested nor downloaded. These headers are live evidence of public artifact endpoints; source contents and secret presence were not inspected. The local baseline regression independently reproduces direct backend artifact serving with synthetic content.

**Proposed repair:** code commit **3c291da1937122427817c74144cf64997ac4f162**, branch `remediation/phase22-readonly-followup`, [draft PR #52](https://github.com/STEYNGROVE/gpu-compute-arbitrage-os-and-connect-it-to-Render./pull/52), based on final Phase22 report commit 62553ad. [server/phase21/staticAssets.ts](../../../server/phase21/staticAssets.ts) restricts static serving to the Vite assets directory plus index.html/SPA navigation. It rejects CommonJS bundles and source maps, including encoded paths, and retains API 404 behavior. [server.ts](../../../server.ts) uses this helper in production. Current build has no public root directory requiring additional asset routes; any future public root files need explicit routing. Existing start/build paths remain compatible; no Render configuration change is needed for the proposed code.

**Regression:** [test/productionStaticAssets.test.ts](../../../test/productionStaticAssets.test.ts) runs isolated loopback HTTP servers and temporary directories. It reproduces the original exposure, rejects root/nested/encoded/query-string/case variants, prevents arbitrary root backend JS disclosure, preserves frontend assets/index/SPA navigation and API fallback, and rejects malformed URL escapes. Two named tests cover these cases, wired into npm test.

**Deployment distinction:** this repair is committed for review, tested locally and submitted as a draft PR. It is not deployed. The earlier service remains unchanged by this work, and the live exposure is not claimed repaired. Urgent release-owner review is warranted; any rollout/mitigation requires separate explicit deployment authorization under the standing restrictions.

## Read-only verification completed and limits

- Final prior Phase22 commit 62553ad was rechecked in GitHub: both hosted workflows succeeded; staging skipped. This does not establish deployed revision or production readiness.
- [public-health.json](public-health.json): fresh GET checks to /api/health and /api/ready timed out after about 15 seconds each. Anonymous /api/owner/phase21/readiness returned 403. That 403 establishes denial for this request, not existence of the Phase21 route or complete deployed RBAC correctness. Health timeouts do not establish database root cause.
- Render tools became callable in this turn. get_selected_workspace reported no selected workspace. list_workspaces returned one workspace, “Steyn’s workspace.” The tool explicitly says: **“ask the user which workspace to use — do NOT pick one yourself.”** An asynchronous confirmation request was sent. Until answered, no service, deployment, database, metrics or log resource reads were attempted. This is a target-selection requirement from the Render tool, not a newly invented production approval requirement.
- No Render names-only environment read tool is exposed. Environment updates are available but prohibited and were not used. No secret-bearing environment-value read was used as a workaround. Actual configuration names, endpoint policy, production role/schema/checksums, backup/rotation evidence and current deployment remain unverified pending authorized target and suitable read-only access.
- Google Drive metadata searches used project names and supplier terms to find existing commercial evidence. A corrected exact name filter returned zero results; broader searches returned an unrelated older spreadsheet that was excluded without reading it. One initial malformed filter returned 400 and was corrected. These bounded results do not prove that relevant evidence does not exist elsewhere. No customer, provider, invoice, payment or rotation record was established.
- No supplier/payment-specific connector was available to establish account-bound commercial evidence. No supplier credentials were retrieved or guessed, no mutation credentials were used, and no messages/outreach were sent.
- The current [Render private-network reference](https://render.com/docs/private-network.md) and [PostgreSQL connection reference](https://render.com/docs/postgresql-creating-connecting.md) were retrieved directly and read. They do not convert a hostname match into server authentication. Actual private-network membership and endpoint configuration still require live metadata.

Machine-readable discovery limits: [evidence-discovery.json](evidence-discovery.json). No new external claim changes any of the five commercial gates from PARTIAL/NOT_VERIFIED.

## Prepared database checks, not executed

[read-only-database-checks.sql](read-only-database-checks.sql) contains six SELECT-only metadata checks: availability/read-only transaction, required tables, migration history, acquisition columns, connector role flags and connector-session TLS. [expected-schema.json](expected-schema.json) records 36 required tables and nine locally computed migration checksums from the actual runtime verifier/source files. This is a local expectation, not a production schema result or approval to run migrations.

After workspace confirmation, select the actual project-linked database from Render metadata before any query; do not guess an ID from hostname shape. Use the tool’s read-only transaction wrapper. Return metadata/checksum comparisons, not database URLs or financial/customer rows. Connector role/TLS results describe the tool connection, not the application’s role/transport. Missing tables/checksums must remain a compatibility blocker; do not repair them with production DDL.

## Safeguards and remaining blockers

Auth/financial policy/emergency-latch/migration files and CI workflows have no diff from 62553ad. Full regression checks are recorded below. DISCOVERY_ONLY, owner RBAC and permanently engaged emergency stop remain enforced. No provider/payment/trading/payout activation occurred.

Remaining blockers are: live backend artifact exposure until an approved rollout; workspace confirmation and actual names-only production configuration/schema/role/checksum evidence; independent credential-rotation/backup-restore records; unprotected main; and all five commercial gates described in the [Phase22 report](../phase22/RELEASE_GATE_REPORT.md). A read-only metadata check cannot certify a live purchase gateway, guaranteed capacity, billing cutoff, production financial ledger or genuine payment chain. Paid lifecycle or production changes remain outside scope.

Rollback: abandon or review-revert this proposed code on its review branch; deployed state is unchanged. Keep the prior TLS fixes and financial lockdown. A future rollout/rollback requires owner approval, retained trusted artifacts and schema compatibility checks; never disable TLS verification or apply migrations to force readiness. No database rollback is required by this static-serving code change.

## Verification

Exact commands, exits, durations and retained logs are in [commands.json](commands.json), generated by [run-verification.py](run-verification.py). Newly added files were staged before security scanning. Static HTTP tests are local fixtures; PostgreSQL integration owns and stops a disposable cluster. The strict launch audit’s exit 1 remains a release blocker, not a passing check. Hosted CI is recorded separately for the exact candidate SHA.

| Command | Exit | Result / log |
|---|---|---|
| `npm run typecheck` | 0 | Pass; [00.log](00.log) |
| `npm run lint` | 0 | Pass; [01.log](01.log) |
| `npm run security:check` | 0 | Pass; [02.log](02.log) |
| `npm run test:static-assets` | 0 | 2/2 pass; baseline exposure and fixed HTTP policy; [03.log](03.log) |
| `npm run test:postgres-tls` | 0 | 38/38 pass; [04.log](04.log) |
| `npm run test:phase20` | 0 | 57/57 pass; [05.log](05.log) |
| `npm run test:phase21` | 0 | 65/65 pass; [06.log](06.log) |
| `npm test` | 0 | Full configured chain passes, including scanner 2/2 and new static 2/2; [07.log](07.log) |
| `npm run test:phase21-postgres` | 0 | Disposable database: Phase20 14, archive 9, control 7 scenario groups; actual timeout/recovery and other checks; cluster stopped; [08.log](08.log) |
| `npm run test:purchase-boundary` | 0 | Pass; [09.log](09.log) |
| `npm run audit:gpu-execution` | 1 | Release blocked: 13 safety controls pass, zero safety failures, five commercial blockers; [10.log](10.log) |
| `npm run build` | 0 | Pass with existing large-bundle warning; [11.log](11.log) |
| `git diff HEAD --check` | 0 | Pass; [12.log](12.log) |

Hosted code-commit results: **both workflows passed at 3c291da**. [CI run 43215488918](https://github.com/STEYNGROVE/gpu-compute-arbitrage-os-and-connect-it-to-Render./actions/runs/43215488918) and [offline run 43215488908](https://github.com/STEYNGROVE/gpu-compute-arbitrage-os-and-connect-it-to-Render./actions/runs/43215488908) completed successfully. No failed or pending jobs in that candidate snapshot; staging skipped by design. Exact job/step results are in [hosted-candidate.json](hosted-candidate.json). Later documentation-only commit checks are separately observable on draft PR #52; no claim of deployment follows from any CI result.

## Later workspace confirmation and live verification

The user subsequently confirmed Steyn’s workspace. The [live verification report](../phase22-live/LIVE_VERIFICATION.md) replaces the earlier pending-workspace status with actual service/deploy metadata and read-only database schema/checksum results, including a confirmed missing published_at compatibility blocker. The earlier observations above remain historical; no migration, deployment or configuration change followed the confirmation.
