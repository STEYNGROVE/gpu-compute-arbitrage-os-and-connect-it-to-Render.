# Phase 20 test evidence

This file records actual local executions. Test fixtures are not commercial proof. Production/provider mutation, real payment tests, automatic outreach, deployed smoke and unknown fixed-port database suites were deliberately not executed. These exclusions are not passes.

## Reproduction and isolation

Run `python docs/verification/phase20/run-checks.py` from the repository root. It invokes the inspected commands in `commands.json`, using a whitelist of basic runtime variables plus `NODE_ENV=test` and disabled JSON persistence. Ambient database/provider/payment credentials are excluded. Termux requires the preserved `LD_PRELOAD` runtime support. Fixture-dependent TLS suites receive newly generated local certificates only when no preexisting fixtures exist; only generated fixtures are removed afterward. No real credential file is committed.

`results.json` records latest command results; `attempts.json` preserves earlier attempts, including failures. Logs use distinct attempt filenames and are intentionally Git-ignored. The Phase 19.1 runner/evidence was not overwritten. Individual commands can be selected by their integer index. Re-running only failed/affected commands does not remove previous evidence.

`npm run test:phase20` is appended to the original standard test chain without removing any test. It runs the named model, HTTP, financial boundary, discovery and supplier-balance suites. `npm run test:phase20-postgres` uses the existing disposable harness and never discovers a production target. It initializes its own cluster/password/unused port, checks incorrect-password rejection, creates a random schema, runs existing and Phase 20 checks, and stops its own cluster even on failures. It never contacts or stops existing servers.

## Exact counts and meanings

* Dedicated Phase 20 named Node tests: **57 passed, 0 failed, 0 skipped**, including real owner/CUSTOMER/anonymous HTTP boundaries, numeric/evidence models, cutoff decisions, supplier diagnostics and direct repository denial/error redaction.
* Dedicated Phase 20 disposable PostgreSQL scenarios: **14 passed, 0 failed, 0 skipped**. These are named scenarios, not a count of SQL assertions. Existing reservation/acquisition/commercial checks also run in that harness and remain intact.
* Existing production-auth/evidence Node tests: **18 passed, 0 failed, 0 skipped**.
* Existing network security coverage: **11 suite commands**; latest individual exit statuses appear below. These assert-based suites do not publish a uniform number of named Node tests.
* Legacy `npm test` includes additional assert-based suites, some with their own totals. No artificial aggregate assertion count is manufactured or added to the 57 new named tests. Exact command statuses, logs and named scenario evidence are retained.
* The strict GPU execution audit is intentionally **exit 1**: 13 safety controls pass, zero safety controls fail, five commercial blockers remain. This is an expected launch denial, not a waived test failure.

## PostgreSQL invariants exercised

1. Proposal DDL rollback leaves no new journal table; applying and reapplying succeeds in a disposable schema.
2. Eight same-key concurrent submissions produce exactly one reservation and idempotent replays.
3. Same key/different payload conflicts; one active simulated exposure is enforced.
4. A reconstructed gateway reloads state and verifies the original digest/audit chain.
5. Duplicate transition events replay; changed payloads cannot reuse an event key.
6. Database rejects real authorization, request budget mutation and event update/delete.
7. Independent Node processes serialize reservations across separate connection pools.
8. Child process exit after request INSERT but before COMMIT leaves no reservation/audit; later reservations recover.
9. Simulated lost COMMIT acknowledgement yields uncertainty; lookup/replay finds one durable record.
10. Trigger-induced audit failure rolls back the reservation atomically.
11. Deferred constraint rejects state advancement without its matching audit event.
12. Restart retains stop intent/attempt count/backoff; missing final billing proof cannot reconcile; a valid simulated proof remains simulation only.
13. Expired reservation cannot start after restart and requires cutoff review.
14. Daily budget retains reconciled exposure; zero real money is moved.

Existing reservation tests additionally cover cross-provider serialization, job/daily caps, prior UTC day exclusion, insufficient verified-credit inputs, rollback/recovery and public fail-closed behavior. The acquisition proposal exercises eight-way deduplication, date/description retention, NULL legacy evidence, migration reapply and rollback. Commercial schema tests cover unverified defaults, state/cost/uniqueness/FK constraints and rollback. No result certifies complete financial ledgers, actual account balances, migration history upgrades, live cancellation, replica failure, customer payments or production data.

## Failure history and corrections

Initial new-code type/fixture-export errors were corrected. Disposable tests then exposed a genuine preexisting acquisition primary-key race; the conflict handler was fixed without weakening its eight-writer assertion. New journal SQL parameter type inference and a PL/pgSQL CASE syntax error were corrected and retested in fresh clusters. Initial network socket/final/Node24-lookup attempts failed with missing local TLS fixtures before assertions ran; the reproduction runner was fixed to provision fixtures for each dependent suite. The original network tests, security checks and timing thresholds are unchanged. Earlier failed results remain in attempt history.

Local runtime: Node 24.22.2, npm 12.2.1. Hosted Node 20/22 CI is a separate execution and must be checked against the pushed application commit. No staging deployment/smoke is enabled by this work. The build retains its existing large frontend-chunk warning.

## Latest command results

The table is generated from `docs/verification/phase20/results.json` after execution.
<!-- GENERATED_COMMAND_TABLE -->

| Executed command | Actual exit |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm run security:check` | 0 |
| `npm run test:consolidation` | 0 |
| `npm run test:provider-billing` | 0 |
| `npm run test:purchase-boundary` | 0 |
| `npm run test:simulation-safety` | 0 |
| `npm run test:phase19` | 0 |
| `npm run test:phase20` | 0 |
| `npm test` | 0 |
| `npm run build` | 0 |
| `npm run audit:gpu-execution` | 1 (expected launch denial) |
| `npm audit --audit-level=moderate` | 0 |
| `npm audit --omit=dev --audit-level=moderate` | 0 |
| `npm run test:phase20-postgres` | 0 |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedIntegrationSuite.ts` | 0 |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedDnsIsolationSuite.ts` | 0 |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedTransportSuite.ts` | 0 |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedDnsPinningSuite.ts` | 0 |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedDnsEdgeSuite.ts` | 0 |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedTlsSuite.ts` | 0 |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedSocketSuite.ts` | 0 |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedFinalNetworkSuite.ts` | 0 |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedTimeoutSuite.ts` | 0 |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedNode24LookupSuite.ts` | 0 |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedNode24ProductionSuite.ts` | 0 |
| `NODE_ENV=production STRICT_AUTH_ENFORCEMENT=true tsx --test server/gpuOfferEvidence.test.ts server/gpuEvidenceIntegration.test.ts server/gpuEvidenceHttp.test.ts server/gpuAuthIsolation.test.ts server/gpuOwnerAuthHttp.test.ts` | 0 |
| `git diff --check` | 0 |

Machine-readable exact counts: [counts.json](verification/phase20/counts.json). Latest results: [results.json](verification/phase20/results.json). Failure/retry history: [attempts.json](verification/phase20/attempts.json). Historical migration/source hashes: [source-manifest.json](verification/phase20/source-manifest.json).
