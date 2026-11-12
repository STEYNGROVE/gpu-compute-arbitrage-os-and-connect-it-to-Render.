# Phase 21 test evidence

Actual local executions, not provider/customer/production certification. Reproduce from repo root with `python docs/verification/phase21/run-checks.py`. Commands run with whitelisted runtime variables, test mode and disabled JSON persistence; ambient supplier/payment/database credentials are excluded. Node 24 local runtime; hosted Node 20/22 CI is separate. The disposable harness owns its random local cluster/port/password and never selects a production target. Test TLS fixtures are generated only if absent and only generated fixtures are cleaned up.

`results.json` contains latest command exits, `attempts.json` retains all recorded attempts. Log filenames identify exact attempts; logs are locally retained and Git-ignored. Historical Phase 19/20 results were not overwritten. The Android interruption completed its prior run before recovery; recovery rechecked processes and reran changed suites. Pre-recovery and post-recovery result counts are not added together.

Strict launch audit exit 1 is an actual failing launch gate: 13 safety controls pass and five commercial blockers remain. It is not a passing test and was not weakened. No other failure is relabeled as success. Lint is the existing TypeScript static-analysis script, not an installed ESLint suite.

## Exact command exits

| Command | Exit | Evidence log |
| --- | --- | --- |
| `npm run test:consolidation` | 0 | `check-03-attempt-1.log` |
| `npm run test:provider-billing` | 0 | `check-04-attempt-1.log` |
| `npm run test:purchase-boundary` | 0 | `check-05-attempt-1.log` |
| `npm run test:simulation-safety` | 0 | `check-06-attempt-1.log` |
| `npm run test:phase19` | 0 | `check-07-attempt-1.log` |
| `npm run test:phase20` | 0 | `check-08-attempt-1.log` |
| `npm run test:phase20-postgres` | 0 | `check-14-attempt-1.log` |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedIntegrationSuite.ts` | 0 | `check-15-attempt-1.log` |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedDnsIsolationSuite.ts` | 0 | `check-16-attempt-1.log` |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedTransportSuite.ts` | 0 | `check-17-attempt-1.log` |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedDnsPinningSuite.ts` | 0 | `check-18-attempt-1.log` |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedDnsEdgeSuite.ts` | 0 | `check-19-attempt-1.log` |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedTlsSuite.ts` | 0 | `check-20-attempt-1.log` |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedSocketSuite.ts` | 0 | `check-21-attempt-1.log` |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedFinalNetworkSuite.ts` | 0 | `check-22-attempt-1.log` |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedTimeoutSuite.ts` | 0 | `check-23-attempt-1.log` |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedNode24LookupSuite.ts` | 0 | `check-24-attempt-1.log` |
| `NODE_ENV=test DISABLE_JSON_PERSISTENCE=true tsx test/secureFeedNode24ProductionSuite.ts` | 0 | `check-25-attempt-1.log` |
| `NODE_ENV=production STRICT_AUTH_ENFORCEMENT=true tsx --test server/gpuOfferEvidence.test.ts server/gpuEvidenceIntegration.test.ts server/gpuEvidenceHttp.test.ts server/gpuAuthIsolation.test.ts server/gpuOwnerAuthHttp.test.ts` | 0 | `check-26-attempt-1.log` |
| `npm run typecheck` | 0 | `check-00-attempt-6.log` |
| `npm run lint` | 0 | `check-01-attempt-2.log` |
| `npm run security:check` | 0 | `check-02-attempt-4.log` |
| `npm test` | 0 | `check-09-attempt-2.log` |
| `npm run build` | 0 | `check-10-attempt-2.log` |
| `npm run audit:gpu-execution` | 1 | `check-11-attempt-2.log` |
| `npm audit --audit-level=moderate` | 0 | `check-12-attempt-2.log` |
| `npm audit --omit=dev --audit-level=moderate` | 0 | `check-13-attempt-2.log` |
| `git diff --check` | 0 | `check-27-attempt-2.log` |
| `npm run test:phase21` | 0 | `check-28-attempt-5.log` |
| `npm run test:phase21-postgres` | 0 | `check-29-attempt-5.log` |
| `npm run plan:phase21-migrations` | 0 | `check-30-attempt-3.log` |

## Named counts

```json
{
  "npm run test:phase21": {
    "exitStatus": 0,
    "namedTests": {
      "tests": 64,
      "pass": 64,
      "fail": 0,
      "skipped": 0
    },
    "scenarios": {},
    "log": "check-28-attempt-5.log"
  },
  "npm run test:phase21-postgres": {
    "exitStatus": 0,
    "namedTests": {},
    "scenarios": {
      "PHASE20_POSTGRES_COUNTS": {
        "passed": 14,
        "failed": 0,
        "skipped": 0
      },
      "PHASE21_POSTGRES_COUNTS": {
        "passed": 9,
        "failed": 0,
        "skipped": 0
      },
      "PHASE21_CONTROL_POSTGRES_COUNTS": {
        "passed": 7,
        "failed": 0,
        "skipped": 0
      }
    },
    "log": "check-29-attempt-5.log"
  },
  "npm run test:phase20": {
    "exitStatus": 0,
    "namedTests": {
      "tests": 57,
      "pass": 57,
      "fail": 0,
      "skipped": 0
    },
    "scenarios": {},
    "log": "check-08-attempt-1.log"
  },
  "NODE_ENV=production STRICT_AUTH_ENFORCEMENT=true tsx --test server/gpuOfferEvidence.test.ts server/gpuEvidenceIntegration.test.ts server/gpuEvidenceHttp.test.ts server/gpuAuthIsolation.test.ts server/gpuOwnerAuthHttp.test.ts": {
    "exitStatus": 0,
    "namedTests": {
      "tests": 18,
      "pass": 18,
      "fail": 0,
      "skipped": 0
    },
    "scenarios": {},
    "log": "check-26-attempt-1.log"
  }
}
```

Legacy assert-based suites do not publish one uniform named-test count; do not invent a grand assertion total. Phase 21 named tests cover configuration, readiness timeout/coalescing/reconnect, owner/anonymous/customer routes, emergency latch, shutdown, key revocation, collector TLS/DNS/schema/mismatch, role quotas/output safety, provider/payment contracts, integer model, HTTP headers and lifecycle faults. PostgreSQL scenario counts are scenario groups rather than individual SQL assertions.

Phase 20 disposable scenarios retain multiprocess reservation serialization, abrupt child exit before commit, uncertain COMMIT lookup, restart reconstruction, expiry, durable stop/backoff and atomic audit rollback. Phase 21 adds receipt races/conflict/revocation/immutability, lab event races, exact full reversal, negative/cross-owner/currency/decimal denial, transaction rollback, post-commit entry corruption denial, integer conservation, lease takeover/stale fence and real pg_dump/restoration of disposable data.

## Skips and unexecuted acceptance

Named local suites report skips exactly above. No authenticated real supplier calls (credentials absent), provisioning/cancellation, real payment/refund/chargeback, real customer workflow, production migration/deployment, physical replica failover/lag or production backup restore was executed. Browser/ingress and realistic production load checks remain unexecuted. These omissions are acceptance gaps, not passing fixtures. Production PostgreSQL baseline/privilege certification remains unknown. Complete authoritative ledger, partial refunds/tax/FX and production webhook lifecycle are not implemented by the lab.

Dependency audit uses the current npm registry and is a point-in-time advisory check; lockfile was not changed. Secret pattern scan is limited to changed code/tests; no secret values are emitted. Full source/migration hashes are recorded separately. Financial execution remains unconditionally false and the strict audit denies launch.
