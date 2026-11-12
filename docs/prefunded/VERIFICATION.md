# Verification — 2026-11-12

Source base: `main` at `1d450b95e6d1eb79128e407902c53df2818f010e`.
Feature branch: `feature/prefunded-gpu-job-hunter`.
Environment: Node v24.22.3, npm 12.2.1, Termux/Linux ARM64. GitHub's Node 20/22 CI is a separate check; local success does not certify every production platform.

| Check | Actual result |
| --- | --- |
| `npm ci --ignore-scripts` | Passed, 0 dependency vulnerabilities |
| `npm run lint` | Passed (repository lint script is TypeScript static checking) |
| `npm run typecheck` | Passed |
| `npm run security:check` | Passed with new source files tracked |
| `npm audit --audit-level=low` | Passed, 0 vulnerabilities |
| `npm test` | Entire configured regression chain passed, including new hunter suite |
| `npm run test:prefunded` | 23 passed, 0 failed/skipped |
| `npm run test:phase16-postgres` | Passed against disposable local password-authenticated PostgreSQL only; reported Phase 20: 14, Phase 21: 9, Phase 21 controls: 7 passing checks, plus reservation/concurrency scenarios |
| Additional security and regression groups | All 22 command groups passed (listed below) |
| `npm run audit:gpu-execution` | Exit 0; 13 existing safety controls pass, 5 existing commercial launch blockers remain. This is not financial activation certification. |
| `npm run build` | Passed Vite client + esbuild server bundle; existing large client chunk warning remains |
| `git diff --check` | Passed |

Hunter tests cover committed versus maximum revenue, every cost component, positive net/margin policies, unknown costs, stale/future/signature/account tampering, manual/default trust rejection, funding stages and insufficiency, discovery binding, supplier/contract/fulfillment/eligibility negative attestations, quote expiry during approval, duplicate order and funding-event prevention, actual independent child-process contention, archive corruption/disk failure/stranded lock, persistent stop, four adapter fixtures, malformed upstream responses, arbitrary operation rejection, HTTP owner/customer isolation, CSRF, malformed JSON, secret-safe errors and absence of an execution route. Fixtures and generated trust keys are synthetic test inputs, never actual business evidence.

Additional passing command groups: secureFeedIntegrationSuite, secureFeedDnsIsolationSuite, secureFeedTransportSuite, secureFeedDnsPinningSuite, secureFeedDnsEdgeSuite, secureFeedTlsSuite, secureFeedSocketSuite, secureFeedFinalNetworkSuite, secureFeedTimeoutSuite, secureFeedNode24LookupSuite, secureFeedNode24ProductionSuite, gpuPriceComparisonSuite, gpuNormalizedPricingSuite, gpuNormalizedApiSuite, gpuDemandMatcherSuite, paymentEvidenceReviewSuite, paymentEvidenceLedgerSuite, databaseOutageIsolationSuite, readinessRecoverySuite, outboxRuntimeSuite; one combined node:test invocation covering the five server GPU evidence/authentication files and postgresDiagnostics; and directPurchaseBoundarySuite. Throwaway localhost TLS keys/certificates were removed after tests. Test processes used isolated/sanitized environments and no production database credentials. The PostgreSQL harness initialized, exercised and stopped its own local cluster; no production migration ran.

Live read-only validation: public RunPod GraphQL returned 14 priced catalog offers in the recorded probe; Akash returned HTTP 501. Vast and SAM.gov credentialed requests were not performed. No verified customer funds, firm supplier quote, reseller eligibility, settled payment or actual revenue was observed. See the neighboring probe JSON and README for official documentation and limitations.

Remaining blockers: reviewed trusted funding/contract/eligibility/quote collectors; authentic customer contracts and reserved funds; authorized Vast/SAM read credentials; compatible Akash public node/version; exact supplier capacity and permitted resale/fulfillment terms; independent FX/tax review; durable externally anchored evidence storage and multi-instance coordination. The existing GPU execution audit additionally retains its independent payment/balance, purchase-path certification, provider termination/reconciliation and broader financial-system concurrency certification blockers.

No staging smoke against a deployed version of this feature was claimed: this branch was not deployed. No Render branches/settings, production migrations, payments, bids, GPU rentals, credentials or live financial flags were changed. No simulated receipts, estimates or revenue were represented as actual revenue. The encrypted backup in the original workspace was not opened or changed.

## Follow-up verification

The original PR #56 remains open against `main`. Both GitHub validation workflows passed for original commit `a49a6c012701b8953c218288acd54aee61690476`; deployed staging smoke was skipped. The follow-up adds a credential-free reproducible public diagnostic and three additional tests; all 26 hunter tests and the complete configured `npm test` chain passed. Every hunter POST route now explicitly rejects anonymous, invalid-key and customer sessions before collection. A dashboard render and entrypoint test verifies backend registration, owner middleware, UI navigation and inclusion in the main test command.

The repeat public snapshot in `public-probes-latest.json` contains genuine HTTPS observations, not fixtures: 12 RunPod catalog offers with all normalized rows matched to the exact raw response, and 50 returned Akash orders including 48 marked open with GPU requirements. The Akash deployment query returned HTTP 501, so full Akash adapter discovery remains blocked; escrow verification is not implemented. Public order records are unverified leads, not paid or contractually secured jobs. Funded opportunities verified: zero; realized payment/job revenue verified: none.

A working-tree credential-pattern scan covered 402 tracked/intended files with no detected GitHub, AWS access-key, Slack-token or private-key material. This heuristic scan supplements the repository security check and is not proof that every possible secret format is absent. `npm audit --audit-level=low` again reported zero vulnerabilities. Financial execution stays unavailable after owner review; this follow-up adds no financial operations or production database access.
