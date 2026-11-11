# Phase 18 staging verification — 2026-11-11

Status: read-only staging smoke passed; offline security regression passed; **commercial certification remains blocked**. This report is limited to the checks below and is not an independent security attestation.

## Baseline and scope

`git fetch origin` succeeded before edits. Local HEAD and fetched `security/phase16-launch-readiness` both resolved to `32321cbece4ccd7c1481466c3f416adf79749e26`; `git ls-remote --heads origin` independently confirmed that branch tip. Work began from a clean tree on new branch `security/phase18-staging-verification`. Other GitHub branches were not merged.

Only existing staging URL: https://gpu-compute-arbitrage-os-and-connect-it.onrender.com. No Render configuration/resource changes, deployments, production migrations, paid resources, supplier purchases, trading, settlements or withdrawals were performed. No deployed POST/PATCH/PUT/DELETE requests or owner credentials were used.

## Deployed verification

GET-only smoke at **2026-11-11T11:56:31.035Z** passed **13/13**:

| Request | Result |
| --- | --- |
| `/healthz`, `/api/healthz` | HTTP 200, liveness `ok` |
| `/api/ready` | HTTP 200, `ready`, PostgreSQL `connected`, `Cache-Control: no-store` |
| Readiness revision | `32321cbece4ccd7c1481466c3f416adf79749e26` |
| `/api/owner/config` | Anonymous and invalid credentials: HTTP 403, `OWNER_AUTHENTICATION_REQUIRED` |
| `/api/acquisition/leads` | Both variants: HTTP 403 |
| `/api/owner/customer-intelligence` | Both variants: HTTP 403 |
| `/api/owner/gpu-hunter-x/evidence-review` | Both variants: HTTP 403 |
| `/api/treasury/profit-withdrawals/status` | Both variants: HTTP 403 |

Readiness executes `SELECT 1` after checking a live PostgreSQL connection; this proves connectivity at request time, not database durability or financial certification. Liveness plus readiness prove an application process successfully started and served these requests. Historical startup logs, Render deploy lifecycle, compute plan and selected source/auto-deploy configuration require account inspection; they have not been verified by HTTP. Render workspace discovery returned one workspace; account-level inspection awaits workspace confirmation. No secret values were requested.

Repeat with `npm run test:staging`. The target origin is fixed; redirects reject, requests time out after 60 seconds, and only GET is implemented. `EXPECTED_STAGING_REVISION` can assert a separately confirmed 40-character deployed commit; default is the verified baseline. The runner never deploys.

## Security findings and repairs

- Owner middleware fails closed for missing/short/default owner secrets, uses timing-safe comparisons, and rejects invalid sessions. Owner-only routes check OWNER role. Production disables the development session fallback; strict enforcement can also disable it in development. Existing session expiry/revocation and customer ownership checks remain. Browser cookies use HttpOnly and production Secure settings. Query-string session tokens remain a source of possible URL/log exposure and should be retired in a separately reviewed compatibility change.
- Global API middleware protects legacy internal routes; discovery registrations before it carry their own owner guard. HTTP tests exercise the actual middleware. Public liveness/readiness expose only state/revision. No successful owner/customer login was attempted on staging; authenticated workflow behavior and deployed secret configuration are not certified.
- Repaired global rate limiting: raw caller-controlled `X-Forwarded-For` no longer selects the bucket. It uses Express's peer address policy, expires buckets, bounds map size, fails closed at capacity and returns Retry-After. A local HTTP test rotates forwarding headers and still gets HTTP 429, then verifies exact-window recovery. No staging load/rate-limit stress was performed. With trust proxy disabled, proxied clients may share a bucket; per-client proxy trust configuration needs a separately verified ingress policy. Limits remain per-process and are not distributed abuse protection.
- Tracked-file credential checks and dependency audit passed; no secret values were printed or committed. These checks do not certify the contents/rotation of Render secrets or absence of all possible leaks.
- Source review found lazy `CREATE TABLE IF NOT EXISTS` in discovery/customer-intelligence GET initialization. Authenticated deployed GETs were therefore avoided. That existing schema-initialization behavior remains a blocker for unrestricted read-only certification of those workflows.

## Commercial blockers improved offline

All additions remain disconnected from runtime execution and grant `executionAuthorized: false`.

| Open blocker | Offline improvement | Missing live/independent proof |
| --- | --- | --- |
| Unified purchasing gateway | Shadow journal replay rejects duplicate reservations, cross-provider ID reuse, concurrent jobs, daily overspend and retries after ambiguous dispatch without absence reconciliation; runtime gateway remains unconditionally denied | Audited single dispatch path, durable intent/idempotency and recovery |
| Supplier evidence | Canonical flat snapshot digest review detects tampered financial/account fields; evidence lifetime capped at five minutes | Trusted authenticated collector, account-bound balances and no auto-charge |
| Termination | Snapshot-bound terminal/invoice assessment, whitespace/oversized invoice rejection, cutoff/cost quarantine regressions | Provider-backed cutoff, retry/restart and final continuing-charge reconciliation |
| PostgreSQL | Offline manifest rejects missing concurrency/replay/restart proof; real disposable reservation test rerun; audit text now accurately distinguishes primitive testing from full certification | All financial repositories, baseline upgrades/replay, crash recovery and replica invariants |
| Prepaid payment evidence | Snapshot binding, strict final/exact payment checks and whitespace/oversized event rejection | Trusted payment lifecycle and atomic durable event deduplication/ledger credit/reversals |

Drill records, callback reviews and caller-supplied manifests are not independent evidence and cannot close these blockers. Canonical digest checks are not signatures. Replay prevention is not implemented by the offline assessor.

## Discovery and qualification

Pure offline evaluation distinguishes buyer requests, supplier offers, discussion sources and employment. A buyer-review candidate remains unverified with no confirmed buyer intent or customer verification. Even profitable matching with all caller flags true yields `executionEligible: false`, `procurementEnabled: false`, zero realized revenue and mandatory full-cost/execution approval. Existing evidence HTTP suites validate freshness, invalid prices, capacity and authentication. No discovery scan, evidence import, qualification update or outreach was submitted to staging. Authenticated staging data/content remains unverified.

## Executed verification

| Check | Exact outcome |
| --- | --- |
| TypeScript (`npm run typecheck`) | Exit 0 |
| Full `npm test` | Exit 0; includes simulation safety, Phase 16, Build 57 and Phase 18 |
| Build 57 | 32/32 passed |
| Simulation lockdown within full tests | Six policy + four runtime cases passed; connected-database LIVE configuration caused zero financial/GPU side effects; 40 HTTP write variants blocked offline |
| Direct purchase boundary | Exit 0; blocked before provider calls |
| Real owner/evidence suites | 18 passed, zero failed/skipped under production + strict authentication |
| Phase 18 offline suite | Passed canonical binding, five blocker drills, discovery invariants, smoke failure contracts, forwarding-header bypass regression, real OWNER/CUSTOMER role rejection, valid owner access, expired/revoked session rejection, tenant ownership and five-attempt login throttling |
| Isolated PostgreSQL | Exit 0; serialization across providers, duplicate rejection, rollback/recovery, per-job/day caps, UTC accounting, insufficient balance; disposable cluster stopped |
| Tracked-file security check | Exit 0, including staged new code |
| Whitespace review | `git diff --cached --check` passed |
| Dependency audit | Exit 0, zero vulnerabilities |
| Production build | Exit 0; existing >500 kB frontend chunk warning and approximately 1.2 MB server bundle |
| Strict GPU execution audit | Expected exit 1: 13 safety controls passed, zero failed, five commercial blockers remain |

Isolated PostgreSQL artifacts: `/data/data/com.termux/files/usr/tmp/phase16-pg-ToHsCm`. Command logs are retained outside Git in `/data/data/com.termux/files/usr/tmp/phase18-verification/`. No production database URL was used by the isolated harness.

The added GitHub workflow runs offline checks on the Phase 18 branch/PRs. The network smoke job runs only on manual dispatch with its explicit boolean input; no credentials or deploy actions are present. CI execution after push must be distinguished from local results.

Final commit and remote push outcome are reported in the accompanying completion message, since a commit cannot contain its own hash. The new branch is for review only; the baseline deployment remains the intended live revision. Deployment requires separate confirmation of intended branch and configuration.
