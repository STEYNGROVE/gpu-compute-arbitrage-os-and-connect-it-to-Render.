# Final Phase 25 recovery verification — PR #59

> Earlier investigation snapshot: the thirteen-file review appended below supersedes the local test counts and commit-safety assessment in this snapshot. Hosted CI and live observations below are dated evidence, not a new remote verification during the file review.

**STAGING VERIFICATION PENDING.** Local verification only. HEAD remains `e00777c2471e0d306fb49ccb0a5d9cbded930432` on `fix/pg-connection-lifecycle-20261113`. Corrections described here are **uncommitted and unpushed**; hosted CI has not run them. No PR state/settings, deployment, Render environment/branch, service restart, production database query, production migration, payment, procurement, customer order or trading operation was issued. Only public GET health requests and read-only GitHub/Render metadata access were used remotely. Local PostgreSQL fixtures are disposable and isolated.

## GitHub review using gh CLI

[PR #59](https://github.com/STEYNGROVE/gpu-compute-arbitrage-os-and-connect-it-to-Render./pull/59) independently remains OPEN, DRAFT, unmerged and MERGEABLE. Remote head is e00777c, base is main at `83578e61cd9265629d0fda311b41aa5c0904e27c`. `git fetch origin main` and ahead/behind comparison show 1/0, with the Phase 25 merge an ancestor. No merged-main commit is missing. The PR has 31 changed files; all changed paths, metadata, check runs, job steps, annotations, review threads and issue comments were read with `gh pr view`, `gh api .../pulls/59/files --paginate`, checks/jobs/annotation REST endpoints and a read-only GraphQL reviewThreads query.

| Hosted check at e00777c | Exact result | Evidence |
| --- | --- | --- |
| Lint, Test & Production Build | SUCCESS, completed 08:51:00 UTC | [Run 43396243085 / job 131787726735](https://github.com/STEYNGROVE/gpu-compute-arbitrage-os-and-connect-it-to-Render./actions/runs/43396243085/job/131787726735) |
| offline | SUCCESS, completed 08:50:46 UTC | [Run 43396243011 / job 131787726459](https://github.com/STEYNGROVE/gpu-compute-arbitrage-os-and-connect-it-to-Render./actions/runs/43396243011/job/131787726459) |
| staging | SKIPPED; no steps executed | [Job 131787728800](https://github.com/STEYNGROVE/gpu-compute-arbitrage-os-and-connect-it-to-Render./actions/runs/43396243011/job/131787728800) |

All executed steps in the two successful jobs succeeded, including the offline disposable PostgreSQL harness. Each successful job has two annotations: a warning about Node 20 action runtimes being forced to Node 24, and an ubuntu-latest image migration notice. There are no failure annotations. These action-runtime warnings do not prove an application Node/TLS failure. Workflow application versions are Node 20 and 22; local verification uses Node 24.22.3.

There are **zero submitted reviews and zero review threads**. The only issue comment is CodeRabbit's explicit **Draft PR not reviewed** notice. Absence of threads is not approval. The staging job requires manual workflow_dispatch opt-in; its skip is not staging verification. The strict commercial architecture audit is not a CI launch gate in these two jobs. Its nonzero result remains a release blocker. Neither old green CI nor the new local passes certify deployment or commercial operation. Raw gh summaries are retained locally in `initial/mission-review/github-summary.log` and `pr-files.log`.

## Locally reproduced defects and focused fixes

1. **Wrong staging smoke target.** The script selected the separate legacy service. A new literal-target assertion failed before correction. It now uses the specified simulation staging origin, still GET-only with redirect rejection and exact expected revision. It additionally requires explicit false financial-authorization and commercial-certification flags. Offline fixtures reject either flag being true. No Render setting changed.
2. **Incomplete commercial readiness.** Only four prerequisite tables had column/type contracts; the three v5 consumers could lack required columns while readiness passed. Three missing-column tests reproduced the acceptance. The read-only contract now covers commercial_verification, commercial_quote_evidence and commercial_evidence_audit as well. An actual disposable PostgreSQL scenario verifies all seven tables against that contract.
3. **Migration-history drift accepted.** Runtime verification accepted unknown/duplicate history and an empty SQL source directory. Three regressions reproduced missing rejections. These now fail with MIGRATION_INTEGRITY_FAILURE, aligning runtime with the offline runner's complete-source/unique-history policy. No SQL or applied checksum file changed.
4. **Verifier process leak.** A local reproduction forced a 0.4-second timeout: the old command exited 124 but a grandchild remained running. The fixture was explicitly cancelled. Commands now own a new process session; timeout/interruption terminates the whole owned process group, including TERM-ignoring grandchildren. Aggregate nonzero behavior is preserved. Import has no execution side effects; result writes are atomic and Python/node counts are reported separately. Six Python regression cases run through test:phase25/npm test; Python 3 and POSIX process groups are required for this verification helper, available in the Termux/Ubuntu environments used here.

The first full run of the new Python cleanup test raced asynchronous SIGKILL delivery; a subsequent attempt encountered Termux ESRCH while reading a disappearing /proc status entry. The test now polls for at most one second and treats only missing/departed processes as terminated. A genuinely surviving child fails. Three consecutive Python runs, the final Phase 25 run, and the rerun full npm suite passed. These failed intermediate attempts are preserved locally, not suppressed or presented as passes.

Focused local files: `.gitignore`, `package.json`, `scripts/staging-smoke.mjs`, `server/commercialSchema.ts`, `server/pgDatabase.ts`, `test/phase18StagingSuite.ts`, `test/phase25Recovery.test.ts`, `test/phase25CommercialPostgres.ts`, `test/verificationRunnerSuite.py`, and `docs/verification/phase25-recovery/run_checks.py`. The three requested review documents are added/updated. Generated caches and local evidence are ignored. No raw logs, credentials, compiled output or node_modules are staged.

## Lifecycle, TLS and schema review

The e00777c lifecycle's pool identity plus health-generation guards, coalesced initialization/probes, drain-once weak registry, observed cleanup rejection, stale-client release and shutdown behavior remain intact and pass regression tests. Production skipSchemaCheck cannot skip verification. Readiness rechecks bootstrap/lifecycle, database health and discovery safety; it never grants financial/commercial authorization. A failed bootstrap does not silently become READY from a later SELECT. Five-second connection/query/statement deadlines remain bounded. Callers must still release transaction clients they obtain; graceful shutdown's outer deadline bounds a leaked caller-owned transaction.

Every production endpoint requires authenticated TLS; a private-looking hostname or private-network marker cannot grant plaintext or certificate trust. Unsafe URL/driver overrides are rejected/normalized. The production CA loader must read nonempty input; actual TLS handshakes reject unrelated, expired or mismatching certificates. Local isolated fixtures exercise valid/untrusted CA, hostname mismatch and expiry. No server identity check or certificate verification is disabled.

The original creating migration covers four commercial prerequisites and orders before the v5 foreign keys. The later guards prevent documentary metadata modification, repeat review decisions, audit mutation and TRUNCATE. The real local fixture tests constraints, FK rejection, deduplication, repeatability and immutable evidence. Existing versioned SQL is unchanged in this follow-up. Runtime verification remains read-only. Missing sources/checksums, incompatible types and unknown/duplicate history fail closed.

Live schema, ledger/audit integrity, role privileges, applied migration history and primary/fallback logical-database equivalence are not independently established. A previously applied v5 migration with the earlier prerequisite absent remains a non-prefix history: **do not bypass the runner, forge applied rows or edit old checksums**. IF NOT EXISTS does not repair incompatible existing constraints. The acquisition published_at proposal still requires a separately reviewed versioned-source/deployment plan. Elevated owners can bypass database triggers; independent audit retention and least privilege remain required.

## Public staging and Render evidence

Three independent public GET requests started **2026-11-13 08:56:10 UTC**: /api/ready returned **200**, status ready, database connected, revision **c9d903330db55892ed2d4f18a2e54524917a85b4**; /healthz and /api/healthz returned **200**, status ok. Each request took about 22.57 seconds. The readiness body did not include the newer explicit financial/commercial fields. Those live fields/configuration therefore cannot be attested from this response.

The corrected smoke script was also executed read-only with expected revision e00777c. It exited **1**, explicitly reporting actual c9d9033 versus expected e00777c. It stopped at revision validation; no later owner/private-route checks ran. **PR #59 is not demonstrated deployed.** A readiness 200 for an older revision does not certify the PR.

Fresh authorized read-only Render API inspection still lists latest deploy `dep-dbrbfos9v7es73a1gjn0` for main `83578e61...` as **update_failed**. PostgreSQL remains **available**, free plan, major 18, Ohio, expiry **2026-11-27T17:21:10.507676Z**. Prior timestamped incident evidence links TLS_CERTIFICATE and BOOTSTRAP_FAILED to two Phase 25 instances. A renewed filtered log query again returns those two generic category records only, hasMore=false, with no exact TLS code. The exact original TLS code is **not** recoverable from the category alone. Endpoint category, effective CA/root configuration and runtime CA-file existence/readability remain unknown; the connector has no environment-read or runtime-file operation and no local Render API key is available. No connection string, endpoint hostname, token, private key or CA content was requested or printed.

Render documents self-signed internal TLS without verify-ca/verify-full support, while external endpoints use Render-managed TLS. This makes internal trust incompatibility a hypothesis, not the verified incident cause. Preserve authenticated TLS and first obtain deployment-matched sanitized evidence; an independently verified provider external endpoint with maintained roots/approved CA is the supported proposal when internal transport cannot satisfy that requirement. [Render PostgreSQL TLS policy](https://render.com/docs/postgresql-creating-connecting.md).

## Actual local validation

Raw logs and JSON ledgers below are **local-only ignored artifacts**, not proposed committed evidence. They retain exact command, exit, duration, node/Python counts and log names. Counts across commands overlap; no unique-test total is invented. Legacy PASS records can represent multiple assertions or summaries.

| Command | Pass / fail / skip reporting units | Exit | Seconds | Local log |
| --- | --- | ---: | ---: | --- |
| `npm run typecheck` | static/build command; no test cases | 0 | 26.507 | `initial/mission-review/full/check-0-npm-run-typecheck.log` |
| `npm run security:check` | 1 PASS records, 0 failures, 0 skip notices | 0 | 1.479 | `initial/mission-review/full/check-1-npm-run-security-check.log` |
| `node --import tsx --test test/phase21Readiness.test.ts` | 21/0/0 node tests | 0 | 1.426 | `initial/mission-review/full/check-2-node-import-tsx-test-test-phase21Readiness-test-ts.log` |
| `npm run test:phase21` | 65/0/0 node tests | 0 | 4.376 | `initial/mission-review/full/check-3-npm-run-test-phase21.log` |
| `npm run test:phase25` | 72/0/0 node tests; 6/0/0 Python tests | 0 | 10.753 | `initial/mission-review/runner-final/check-3-npm-run-test-phase25.log` |
| `node --import tsx test/readinessRecoverySuite.ts` | 4 PASS records, 0 failures, 0 skip notices | 0 | 1.482 | `initial/mission-review/full/check-5-node-import-tsx-test-readinessRecoverySuite-ts.log` |
| `node --import tsx test/databaseOutageIsolationSuite.ts` | 4 PASS records, 0 failures, 0 skip notices | 0 | 0.726 | `initial/mission-review/full/check-6-node-import-tsx-test-databaseOutageIsolationSuite-ts.log` |
| `npm test` | 254/0/0 node tests; 6/0/0 Python tests; 615 legacy PASS records; 3 legacy skipped groups | 0 | 105.886 | `initial/mission-review/runner-recheck/check-3-npm-test.log` |
| `npm run test:purchase-boundary` | 1 PASS records, 0 failures, 0 skip notices | 0 | 0.924 | `initial/mission-review/full/check-8-npm-run-test-purchase-boundary.log` |
| `npm run test:phase25-postgres` | 53 counted scenarios passed, 0 failed, 0 skipped; 7 other summary/legacy PASS lines | 0 | 29.277 | `initial/mission-review/full/check-9-npm-run-test-phase25-postgres.log` |
| `npm run build` | static/build command; no test cases | 0 | 18.176 | `initial/mission-review/full/check-10-npm-run-build.log` |
| `git diff --check` | static/build command; no test cases | 0 | 0.070 | `initial/mission-review/full/check-11-git-diff-check.log` |

The full npm result is independently **254 node tests passed, 0 failed, 0 skipped**, plus **6 Python tests passed, 0 failed, 0 skipped**, 615 legacy PASS records and three intentionally skipped live-operation groups. Baseline 248/66 counts were not reused: six new schema/history cases increase full node executions to 254 and standalone Phase 25 to 72. The three skipped groups remain withdrawal execution tests 9–15, live provisioning offer-ID validation and legacy live termination confirmation; the old harness does not give a unified skipped-case count. Actual local PostgreSQL groups are 14 Phase 20 + 9 Phase 21 + 7 control-lab + 15 Phase 23 + 8 commercial = **53**. The new eighth commercial scenario checks every required type across all seven tables. The build succeeds with the existing >500 kB Vite performance warning.

The separate strict commercial audit exits **1** (1.176 seconds): 13 safety controls passed, 0 failed, five declared integration blockers. The live expected-PR-revision smoke exits **1** (2.488 seconds) because staging serves another SHA. These are real negative release checks, not passing regressions. Ledgers: `initial/mission-review/commercial-audit/results.json` and `initial/mission-review/public-smoke/results.json`. The earlier full runner exits 1 because of the corrected Python test timing error; its initial npm test is not reported as successful. Final per-command results above use the successful reruns.

## Decision and next actions

Local corrections are ready for human review; they have **not** been committed, pushed or tested by hosted CI. PR #59 remains draft. Review the local diff first. Obtain the endpoint category, effective CA configuration/file-status attestation and exact TLS code (if retained) without secrets. Review real schema/history and continuity custody evidence. A future authorized release must independently demonstrate the intended SHA, TLS/schema/bootstrap readiness, discovery-only flags and RBAC. No deployment readiness or commercial certification is claimed.

See [REMAINING_BLOCKERS.md](REMAINING_BLOCKERS.md) and [POSTGRES_CONTINUITY.md](POSTGRES_CONTINUITY.md). Stop at local verification.

## Final local state

Final checks: tracked-file security scan exit 0 (1.844 seconds), working-tree diff check exit 0 (0.073 seconds), plus an additional scan of all 13 modified/new files including untracked Python/docs found zero secret-pattern findings, unexpected generated artifacts or missing local document links. Evidence: `initial/mission-review/final-static/results.json`. The Git index is empty; all 13 files remain unstaged/new. HEAD remains e00777c; a final fetch still shows 1/0 ahead/behind origin/main. No verification runner or disposable PostgreSQL process remains active. Observed local tools: Node v24.22.3, Python 3.14.10, PostgreSQL 18.6. The server metadata reports PostgreSQL major 18 only; no live minor version is inferred.

No commit, push, merge, GitHub change or Render mutation was performed. Older committed review ledgers describe the earlier baseline and remain historical; this document is the current verification result for the uncommitted corrections.

## Thirteen-file commit-safety review

This section is the current local review of all thirteen requested working-tree files, including the complete untracked documents and Python test. No production endpoints or remote configuration were modified or newly probed during this review. All changes remain unstaged at HEAD e00777c. PASS here means safe for a local code-review commit after the recorded checks; it does not authorize commit execution, merge or deployment.

| Changed/new file | Review | Evidence and disposition |
| --- | --- | --- |
| .gitignore | PASS | Ignores generated Python caches and local evidence only; no secret exclusion was relaxed. |
| docs/verification/phase25-recovery/POSTGRES_CONTINUITY.md | PASS | Deadline is tied to the dated read-only provider evidence. RPO/RTO and provisioning are proposals requiring approval, not guarantees or executed actions. |
| docs/verification/phase25-recovery/run_checks.py | PASS after correction | Keeps command exits and aggregate failures authoritative; removes negative/invented Python case counts for failed/skipped subtest summaries. Such summaries now expose reported totals and failure/skip events with unknown case counts. Positive unambiguous runs retain exact counts. |
| package.json | PASS | Test command chaining propagates failures; Python 3 is an explicit test prerequisite. Production start/build behavior and financial settings are unchanged. |
| scripts/staging-smoke.mjs | PASS after correction | Fixed staging origin, exact revision, explicit false safety flags, authenticated HTTPS defaults and no redirects. CLI logs fixed failure codes rather than assertion messages containing response values. |
| server/commercialSchema.ts | PASS | Extends read-only required-type checks to all seven commercial tables; does not claim constraints/precision/privileges are certified. |
| server/pgDatabase.ts | PASS | Added history rejection is fail-closed and SELECT-only. Pool generation, timeouts, TLS policy and financial isolation are not weakened. |
| test/phase18StagingSuite.ts | PASS | Preserves strict negative contracts and adds a spawned CLI test proving mocked fetch was called, process exit is 1, and raw response values are absent from diagnostics. No network is opened by the new test. |
| test/phase25CommercialPostgres.ts | PASS after correction | Removed suppressed schema-cleanup errors. Cleanup still closes the client on failure, and a fault-injection scenario verifies propagation. Actual SQL remains restricted to the owning disposable fixture. |
| test/phase25Recovery.test.ts | PASS | Six added schema/history cases reject unsafe states; no existing assertion is relaxed. Migration-runner subprocesses use validation/incomplete authorization or explicit remote-target rejection. |
| docs/verification/phase25-recovery/FINAL_VERIFICATION.md | PASS after update | Earlier evidence is explicitly historical; the current review records exact fresh results and separates regression passes from negative release checks. |
| docs/verification/phase25-recovery/REMAINING_BLOCKERS.md | PASS after update | Keeps live TLS/schema/continuity/review blockers explicit and distinguishes local commit safety from release authorization. |
| test/verificationRunnerSuite.py | PASS after correction | Real subtest failures demonstrate that failure-event totals cannot establish distinct failed-case counts. Timeout observation requires POSIX plus /proc; unsupported platforms explicitly skip that observation rather than falsely pass it. |

Three further review findings were corrected within the same thirteen files: suppressed fixture cleanup failure, inaccurate Python summary metrics (including a reproduced negative pass count), and raw CLI assertion diagnostics. No TLS bypass, schema mutation on startup/readiness, financial bypass or production configuration change was found or introduced. No versioned migration file changed. DISCOVERY_ONLY and financialExecutionAllowed=false remain enforced by unchanged runtime guards and passing negative tests.

No file among these thirteen needs exclusion from a focused local commit after review. Exclude ignored initial/ evidence, raw logs, __pycache__, generated TLS private keys/certificates, node_modules and dist output. These are not among the thirteen proposed files. Hosted CI still has not run this uncommitted final patch, and all release blockers remain.

### Current review validation results

Every command below executed locally; overlapping suites are not added together. Full-run evidence is under `initial/file-review/full/`; the final regression supersedes typecheck, phase18 and npm test after the last test edit.

| Exact command | Exit | Seconds | Counts / result |
| --- | --- | --- | --- |
| `npm run typecheck` | 0 | 23.906 | static/build check successful; no test-case count |
| `npm run security:check` | 0 | 1.184 | 1 legacy PASS records |
| `node --import tsx --test test/phase21Readiness.test.ts` | 0 | 1.389 | Node 21/0/0 pass/fail/skip |
| `npm run test:phase21` | 0 | 4.187 | Node 65/0/0 pass/fail/skip |
| `npm run test:phase25` | 0 | 11.517 | Node 72/0/0 pass/fail/skip; Python 7/0/0 pass/fail/skip |
| `npm run test:phase18` | 0 | 5.499 | 2 legacy PASS records |
| `node --import tsx test/readinessRecoverySuite.ts` | 0 | 1.426 | 4 legacy PASS records |
| `node --import tsx test/databaseOutageIsolationSuite.ts` | 0 | 0.724 | 4 legacy PASS records |
| `npm test` | 0 | 101.764 | Node 254/0/0 pass/fail/skip; Python 7/0/0 pass/fail/skip; 615 legacy PASS records; 3 skipped legacy groups |
| `npm run test:purchase-boundary` | 0 | 1.023 | 1 legacy PASS records |
| `npm run test:phase25-postgres` | 0 | 30.527 | 54 scenarios passed; 0 failed; 0 skipped (31 output PASS records are not a distinct test total) |
| `npm run build` | 0 | 17.52 | static/build check successful; no test-case count |
| `git diff --check` | 0 | 0.069 | static/build check successful; no test-case count |

Exact per-command log paths and durations: `initial/file-review/full/results.json` and `initial/file-review/final-regression/results.json`. Final regression background process exited **0**. The three skipped legacy groups are withdrawal execution tests 9–15, live provisioning offer-ID validation, and legacy live termination confirmation. Node and Python suites skipped zero cases. Vite chunk-size warnings remain performance concerns only.

The separately executed `npm run audit:gpu-execution` exited **1** in 0.930 seconds: 13 safety controls passed, 0 failed, five declared commercial certification gates remain open. Evidence: `initial/file-review/release-audit/results.json`. This negative release result remains a blocker and was not hidden by the regression runner. No live staging smoke was executed during this file review; the failed revision assertion above is earlier evidence.
