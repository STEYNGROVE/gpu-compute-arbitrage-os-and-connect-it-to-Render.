# Commit-finalization verification

The eleven commands below executed successfully after the staged source review. No application source changed from the previously verified repair. The verifier excludes inherited application credentials, sets test/discovery mode and does not invoke a migration harness by default. No database migrations were executed during this finalization.

Machine-readable command/exit/count/duration evidence: [commit-checks/results.json](commit-checks/results.json). Raw log names in that ledger refer to ignored local files, intentionally excluded from the commit; earlier redundant ledgers/reports are archived locally under ignored initial/review-archive/ files. Reproduce the safe checks with [run_checks.py](run_checks.py).

| Exact command | Pass / fail / skip reporting units | Exit | Seconds |
| --- | --- | ---: | ---: |
| `npm run typecheck` | static/build command; no test cases | 0 | 23.858 |
| `npm run security:check` | 1 PASS records / 0 failures / 0 skip notices | 0 | 1.228 |
| `node --import tsx --test test/phase21Readiness.test.ts` | 21 / 0 / 0 node tests | 0 | 1.429 |
| `npm run test:phase21` | 65 / 0 / 0 node tests | 0 | 4.012 |
| `npm run test:phase25` | 66 / 0 / 0 node tests | 0 | 7.888 |
| `node --import tsx test/readinessRecoverySuite.ts` | 4 PASS records / 0 failures / 0 skip notices | 0 | 1.428 |
| `node --import tsx test/databaseOutageIsolationSuite.ts` | 4 PASS records / 0 failures / 0 skip notices | 0 | 0.726 |
| `npm test` | 248 / 0 / 0 node tests; 615 legacy PASS records; 3 legacy skipped groups | 0 | 99.688 |
| `npm run test:purchase-boundary` | 1 PASS records / 0 failures / 0 skip notices | 0 | 0.874 |
| `npm run build` | static/build command; no test cases | 0 | 15.255 |
| `git diff --check` | static/build command; no test cases | 0 | 0.037 |

The three skipped legacy groups are withdrawal execution tests 9–15, live provisioning offer-ID validation, and legacy live termination confirmation. The legacy harness does not expose a unified skipped-case total; three groups are not three test cases. PASS records can summarize multiple assertions. Counts across commands overlap because the full npm suite repeats standalone suites; no unique-test aggregate is claimed. The Vite >500 kB chunk warning remains a performance concern, with build exit 0.

## Prior isolated PostgreSQL evidence

[POSTGRES_TEST_EVIDENCE.json](POSTGRES_TEST_EVIDENCE.json) retains the earlier actual disposable PostgreSQL run: **52 counted scenarios passed, 0 failed, 0 skipped**, exit 0. Groups: Phase 20 14, Phase 21 9, control lab 7, Phase 23 15, commercial Phase 25 7; seven additional summary/legacy PASS lines are not counted as unique extra tests. SQL and harness files still match the tested staged source hash. This is explicitly historical evidence: the integration harness applies fixture migrations and was **not rerun** under the current no-migration instruction.

## Commercial release audit

The prior strict architecture audit exited **1**: 13 safety controls passed, 0 failed, with five deliberately declared unresolved commercial integration gates. The audit is a release assessment, not a passing regression test or a local commit prerequisite. No gate was weakened and no financial activation was performed. Exact release blockers are documented in [CURRENT_BLOCKER.md](CURRENT_BLOCKER.md).

## Review checks

The final staged-file review covers secret patterns, forbidden artifact types, main ancestry, unchanged existing migration sources/checksums, and local Markdown references. [review_checks.json](review_checks.json) records the outcome. Final tracked-file security and staged/working-tree diff checks are required to exit 0 before the local commit. No runtime private-key files, raw logs or superseded verification ledgers are included.
