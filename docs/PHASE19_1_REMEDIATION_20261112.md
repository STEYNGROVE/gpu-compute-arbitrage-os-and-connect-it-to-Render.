# Phase 19.1 remediation and readiness — 2026-11-12

**Disposition: safe development remediation completed; commercial launch remains BLOCKED.** This is a source review and offline/disposable-database verification, not independent commercial or financial certification. No real customers, contracts, supplier capacity, payments or revenue were established by this work.

## Repository and review evidence

Work is confined to `fix/phase19-1-review-findings`. Initial HEAD was `388339d`; the only existing change was untracked `server/commercialLeadFilter.ts.phase19.bak`, preserved and excluded from staging. `git fetch origin main` obtained `00826fb291a84ec4b7da9a00e8e71bad774b2241`, the already-merged PR #44. The authorized branch was fast-forwarded to that commit; no local main or deployment branch was changed. The normally narrow fetch configuration left `origin/main` stale, so an explicit main-to-origin/main fetch updated that tracking reference before final comparison. No Git remote configuration was changed.

Reviewed [PR #44](https://github.com/STEYNGROVE/gpu-compute-arbitrage-os-and-connect-it-to-Render./pull/44), including its eight actionable CodeRabbit comments and two testing comments. All ten issues were verified against code and addressed. Review comments were treated as evidence to investigate, not instructions or proof. Historical Phase 16/18 readiness, safety, integration, CI, staging and follow-up reports informed this review; their historical passes do not certify this revision or current deployments.

No Render tools, deployments, production database connections/migrations, paid services, provisioning, supplier purchases, financial execution, outreach or live customer scans were used. Existing deployment configuration and CI workflows are unchanged relative to fetched main. No dependencies or lockfile were changed. This branch must not be merged as part of this task.

## Verified remediation

| Finding | Implementation | Regression evidence |
| --- | --- | --- |
| Generic `need` admitted tutorials | Service demand requires provider/contractor/service/quote context or explicit procurement intent | Tutorial, ambiguous discussion and genuine service request cases in `commercialLeadFilterSuite` |
| Generic `we provide` rejected buyers | Supplier exclusion matches advertised GPU/compute offerings | Buyer-provided rendering files accepted; genuine supplier advertisements rejected |
| Permissive/local-time publication parsing | Shared strict calendar and explicit-zone validator, including RSS weekday/calendar checks | Invalid days/months, missing zones, multiple local timezone settings, valid offsets and freshness boundaries |
| Blank titles allowed advanced status | Nonempty title required before review/confirmation status | Empty/whitespace title cannot advance; confirmation still has false verification/payment and zero revenue |
| Embedded date tags became evidence | Bounded structural XML reader; publication uses direct entry children | Description/HTML/CDATA/comment/nested date attacks, unrelated namespaces, malformed XML, DTD/entity rejection, size/depth bounds and conflicts |
| Accepted descriptions/dates discarded | Both persistence paths store description and accepted `published_at`; assessments receive that timestamp | Exact accepted URL `https://example.org/jobs/101`, description/date equality and absence of erroneous missing-date reason |
| Missing standard coverage | `test:phase19` added and appended to unchanged existing `npm test` chain | Four requested suites plus new security suite execute in standard verification |
| Scanner fixture identity untested | Assert exact retained URL and timestamp, anonymous GET/PATCH/POST rejection, financial flags, duplicate identity and sanitized failures | HTTP scanner suite covers stale/future/undated/supplier/duplicate entries and transport errors |

The XML reader supports conservative RSS 2.0 and Atom (including standard Atom namespace prefixes), not arbitrary XML vocabularies or every feed extension. It rejects DTDs and declarations rather than resolving them; it performs no external entity access or recursion. Limits: 1 MiB, 20,000 elements, depth 32 and at most 32 inherited namespace declarations (preventing namespace-copy amplification); scanner admits at most 40 entries per configured feed and five feeds. Malformed or unsupported feed formats may be rejected; rejection never establishes customer evidence. The 30-day policy is review eligibility, not independent proof of publication or a contractual deadline.

## Additional confirmed security and integrity defects

* **High — insecure authentication default:** the studio owner-session fallback previously applied with an unset runtime mode unless strict auth was explicitly enabled. It now requires both `NODE_ENV=development` and `ENABLE_STUDIO_AUTH_FALLBACK=true`; production and strict auth still deny it. The legacy `dev_auto` session-creation endpoint uses the same policy, closing its separate permissive default. Existing development users must explicitly opt in if they need the preview fallback.
* **Medium — session URL exposure:** query-string `sessionId`/`session_id` credentials are no longer accepted. Cookies and existing session headers remain supported. Malformed percent-encoded cookies reject safely. HTTP regressions cover query credentials, missing mode, development without opt-in, production with opt-in, revoked/expired sessions and valid owner headers.
* **Medium — runtime schema writes:** acquisition readiness formerly executed CREATE/ALTER. It now performs only a SELECT compatibility probe. Missing schema fails closed with a generic 503; no runtime migration occurs.
* **Medium — supplier payload bounds:** read-only supplier diagnostics previously called unrestricted `response.json()`. They now stream at most 1 MiB of decoded bytes under the existing six-second abort deadline, cancel oversized/invalid streams, and cancel error responses. Tests exercise limits, cancellation and invalid JSON with real synthetic `Response` objects.
* **Medium — misleading supplier authentication/pricing:** diagnostics reject whitespace/object identities and malformed GraphQL errors. Vast base-only pricing no longer substitutes for total cost. Tests cover invalid identities/errors and base-only responses.
* **Medium — inconsistent quote costs:** matching rejects invalid/negative/nonfinite total prices and inconsistent total-versus-per-GPU pricing; overflow cannot create a positive quote. Tests retain full-offer cost, freshness and margin-floor checks.
* **Low — error/URL disclosure:** scanner and storage errors return stable generic codes; unsafe feed references omit userinfo and query data. Regression tests assert synthetic sensitive transport errors and credential-bearing unsafe URLs do not appear in responses.

Owner middleware remains on all affected acquisition and supplier routes; production authentication suites test actual owner/customer guards. Discovery transport is still `secureFeedFetch`: HTTPS, certificate validation, DNS deadline, public IPv4 checks on every DNS answer, one pinned resolution, no redirects, bounded response size and socket/timeouts remain intact. Test transport replacement is rejected outside the isolated test environment, including when a database target is present. HTTP callers cannot supply this dependency.

Database statements use bound parameters; deduplication uses unique `source_url` and a single `INSERT ... ON CONFLICT DO NOTHING`, preserving the first accepted evidence. URL fragments are removed before hashing/insertion. No existing stored URLs are rewritten; historical canonicalization differences require separately reviewed reconciliation. Publication and description are written atomically. Pool connection/query deadlines are five seconds; idle pool errors remain sanitized. Readiness failures reset the cached probe so later attempts can retry.

The existing per-process owner rate limits and development-preview exception are not distributed abuse protection. Live ingress, deployed secrets/TLS settings and infrastructure behavior were not inspected. This review does not certify all unrelated legacy integrations or every possible dependency weakness.

## Customer acquisition capability and limits

The owner-only lead response now includes provenance, expiry, advisory relevance score, workload categories, explicitly mentioned GPU models, published email addresses, mandatory human review and commercial-readiness status. Scanner results include rejection counts for freshness, unclear buying intent, unsafe URLs and duplicates. Source URL/feed and accepted publication date remain attached to each record. Scoring is a bounded heuristic, not a conversion forecast. GPU count, memory and duration remain unknown rather than invented. The 30-day expiry is explicitly labeled a review policy. Published contacts are unverified text and never contacted automatically; lawful use and consent restrictions require human review.

Sources remain explicit operator-configured public feeds; no arbitrary URL is accepted from discovery request bodies and no source or opportunity was invented. **Independently verified public opportunity sources: NOT_VERIFIED.** Operators still need to document source ownership, permitted ingestion/use and a real procurement opportunity before treating a source as qualified. Publisher-claimed dates and procurement language establish candidates only.

Manual `QUALIFIED` status, a review note, a caller-generated digest or a customer confirmation reference cannot establish a verified customer, verified payment or realized revenue. Lead responses explicitly report `NOT_COMMERCIALLY_OPERATIONAL`, supplier capacity/contracts/payments `NOT_VERIFIED`, zero verified customers and zero realized revenue. No synthetic fixture is presented as a real opportunity.

## Supplier and commercial planning assessment

Vast.ai and RunPod remain read-only diagnostic/catalog integrations. Fixed endpoints, bearer headers, redirect rejection and request timeouts are retained. Official [Vast API documentation](https://vast.ai/developers/api) and [RunPod's documented GraphQL examples](https://github.com/runpod/docs/blob/main/sdks/graphql/manage-pods.mdx) were consulted for the offer/query vocabulary. Documentation is not live integration proof. Vast's current documentation shows a `cloud.vast.ai` origin; the retained integration uses `console.vast.ai`. Host compatibility must be independently checked before operational reliance; redirects continue to fail closed. No endpoint migration or paid request was attempted.

**Live supplier authentication, balances, account binding, no-auto-charge, hardware/VRAM, availability and price/quote execution: NOT_VERIFIED.** Credentials were excluded from tests and not inspected. Catalog prices are not reserved capacity. The current diagnostic catalog deliberately reports unknown VRAM/availability, and cannot independently satisfy hardware sizing or supplier qualification. Other legacy provider adapters were not exercised against live services. Synthetic fixtures are only offline tests.

Draft quotation planning charges the full listed supplier bundle for the requested duration, includes additional operating costs and contingency, and now supports explicit platform-fee and utilization percentages. Customer revenue is an estimate; utilization discounts revenue without reducing the reserved supplier cost. Finite values and existing minimum-margin rules remain mandatory. Quotes expose USD currency, a 15-minute catalog-derived expiry, mandatory contract requirement, false payment/availability/purchasing flags and zero realized revenue. No executable invoice, payment request or purchase is produced.

This planner is USD-only; it does not fetch FX rates. Foreign-currency costs/customer pricing require a separately evidenced conversion into USD. Additional expenses, payment/FX fees, taxes, storage/egress, utilization and contingency remain operator assumptions requiring human validation, not independently measured costs. Default platform fee 0% and utilization 100% are visible assumptions, not commercial certification. No price, capacity or margin in tests is a real supplier/customer offer.

## Database migration proposal and deployment dependency

`docs/migration-proposals/20261112_phase19_1_acquisition_publication.sql` is a versioned **unapplied proposal**, outside the automatic migration runner. It supports the acquisition table baseline and adds nullable description/publication fields; historical dates are never fabricated from discovery time. The application now requires these columns. A deployment without a separately reviewed/applied migration will fail acquisition storage safely. Do not deploy this branch before resolving that compatibility dependency through a separately authorized migration process.

The existing disposable cluster harness generated its own password and unused port, required incorrect-password rejection, created its own database/random schema and stopped its own cluster. Acquisition checks exercised baseline upgrade/reapply, legacy NULL preservation, eight concurrent inserts with exactly one success, database/memory evidence parity and rollback. Existing reservation caps, duplicate prevention, cross-provider serialization and recovery tests remained intact. Artifacts for that run: `/data/data/com.termux/files/usr/tmp/phase16-pg-q0elLB` (stopped).

These tests do not establish production baseline compatibility, migration-runner upgrade history, full financial-repository concurrency, crash recovery, replica behavior or live database reconnection under infrastructure failure. No existing PostgreSQL servers were contacted or stopped. Legacy fixed-port and live-evidence workflows were not run against unknown targets.

## Five commercial launch blockers

1. **Unified purchase gateway — CRITICAL / OPEN.** Root cause: legacy purchase paths lack one independently audited durable reservation/dispatch/idempotency boundary. Current evidence: the strict launch audit still rejects this gate. Work: preserved unconditional simulation/direct-purchase denial; repaired discovery and draft planning without connecting either to execution. Tests: purchase-boundary, full financial/simulation suites and launch audit. Remaining dependencies: audited single gateway, durable intent, restart/ambiguous-dispatch reconciliation and independent review. No safe offline change alone proves dispatch correctness.
2. **Trusted supplier balance/capacity evidence — HIGH / OPEN.** Root cause: catalog data and caller-supplied review flags do not establish independently bound live account balances, no-auto-charge or purchasable capacity. Work: bounded diagnostics, strict identity/error checks, total-price requirements and conservative quote flags. Tests: billing, read-only diagnostics, provider readiness, invalid/oversized payloads and pricing checks. Remaining dependencies: authenticated independent collectors, verified hardware/capacity/price freshness, account binding and no-auto-charge proof. Live status: NOT_VERIFIED.
3. **Provider cutoff/termination/reconciliation — CRITICAL / OPEN.** Root cause: offline assessments cannot prove an actual provider stops charging after timeout/cost cutoff. Work: preserved existing denied execution and Phase 16/18 quarantine/reconciliation checks. Tests: unchanged termination/readiness drills and full safety suites. Remaining dependencies: provider-backed failure/retry/restart tests, final invoice and continuing-resource charge reconciliation. No instance was created to obtain this evidence.
4. **Full financial PostgreSQL certification — HIGH / OPEN.** Root cause: isolated primitives do not certify all financial repositories, historical baseline upgrades or multi-replica recovery. Work: removed runtime acquisition DDL; proposed and isolated-tested publication schema upgrade, atomic evidence persistence and concurrent uniqueness. Tests: disposable PostgreSQL harness plus existing reservation/commercial tests. Remaining dependencies: trusted baseline/migration history, complete repository invariants, replay/crash/restart and replica certification. Production schema and data remain unverified and untouched.
5. **Independent prepaid payment lifecycle — CRITICAL / OPEN.** Root cause: no independently verified live adapter proves final exact customer payment, durable event deduplication, credit and reversal handling. Work: retained false payment flags, zero revenue and all financial blockers. Tests: payment evidence/integrity, fake/simulated Binance rejection, provider billing, live-financial lockdown and full npm tests. Remaining dependencies: independently sourced payment lifecycle evidence and audited atomic ledger/reversal behavior under separately authorized work. No payment was requested or processed.

## Verification evidence

Command-level exit statuses are recorded in [phase19-1/results.json](verification/phase19-1/results.json); the table below is generated from that file after final validation. Local logs are retained in the same directory and intentionally ignored by Git. The reproduction runner whitelists only basic runtime environment variables (including Termux's required `LD_PRELOAD`); production database/provider/payment settings are not inherited. Network security tests use local/mocked transports; dependency audits contact the package registry and documentation reads contact public sources, with no paid calls.

Initial credential-isolated runner attempts exited 127 for commands requiring local executables because Termux's execution support variable was omitted; restoring `LD_PRELOAD` fixed the runner environment. These are preserved in `initial-results.json`, not represented as passes. The first complete pass had one failure in a newly added quote expectation: 95% utilization plus 5% fees leaves 9.79% margin, below the original 10% floor. The test now explicitly requires rejection at 10% and separately verifies the arithmetic with a 5% floor. Original assertions/security thresholds were not weakened. Standalone consolidation and the full test chain were rerun successfully; `first-pass-results.json` preserves the failed attempt.

All existing financial controls remain fail closed: payments, withdrawals, trading, treasury execution, GPU purchasing, paid provisioning and supplier settlement remain disabled. Existing LIVE-setting direct-call tests and HTTP write variants verify no financial/provider side effects. Simulated balances and fabricated Binance events do not become verified money. The strict launch audit must continue to exit 1 until all five blockers are actually resolved; it is not disabled or bypassed.

Local runtime is Node **24.22.2**, npm **12.2.1**. Hosted Node 20/22 CI and deployed application behavior are separate, unverified results. Build retains the existing frontend chunk-size warning. Dependency audit results cover known registry advisories, not proof of absence of vulnerabilities.

| Executed command | Actual exit status |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm run security:check` | 0 |
| `npm run test:consolidation` | 0 |
| `npm run test:provider-billing` | 0 |
| `npm run test:purchase-boundary` | 0 |
| `npm run test:simulation-safety` | 0 |
| `npm run test:phase19` | 0 |
| `npm test` | 0 |
| `npm run build` | 0 |
| `npm run audit:gpu-execution` | 1 (five open launch blockers) |
| `npm audit --audit-level=moderate` | 0 |
| `npm audit --omit=dev --audit-level=moderate` | 0 |
| `npm run test:phase16-postgres` | 0 |
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

All commands above were executed. The 11 network suites passed; strict production-auth TAP reported 18 passes, zero failures/skips. The acquisition migration was tested only on the disposable database and was not applied elsewhere. Temporary generated TLS fixtures were removed. Hosted CI and real commercial integrations remain unverified.
