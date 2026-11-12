# Phase 18 engineering follow-up — 2026-11-11

This review starts from `main` merge `388339d59733f026d46d22fdf5bcb75c90ae9c5f` (PR #42, head `4b4346f4cb9242c4251aa0cccfb8e5945d3cde79`). PR #42 is merged. Its CodeRabbit thread list is empty. The latest CodeRabbit summary says there are no actionable comments and reports docstring coverage **100%**, above its **80%** threshold, for the one eligible function touched by that review. `commandCenterJobSummary` has a JSDoc comment immediately above its declaration. The PostgreSQL verification function also has a direct JSDoc comment. The historical failed summary predates that successful review; no other current CodeRabbit finding is outstanding.

## Safe offline evidence and certification boundaries

| Commercial blocker | Safe implementation and regression evidence | Still pending |
| --- | --- | --- |
| One audited purchase gateway | `requestPurchase` always returns denied; gateway drill tests duplicate reservations, provider mismatch, daily cap and ambiguous retry rules in `test/phase18StagingSuite.ts`. Direct-purchase boundary and simulation-lockdown suites remain in CI. | Consolidating every legacy purchase call behind one durable audited gateway and independently reviewing crash/idempotency behavior. |
| Trusted supplier balances | `assessSupplierEvidence` binds provider/account/currency, freshness and payload digest; tampering, wrong account, auto-charge and expiry cases are rejected. The `supplierBalanceReadOnlySuite` and `supplierReadOnlyDiagnosticsSuite` exercise read-only provider diagnostics. | Authenticated supplier collectors, independently sourced account binding and live balance verification. |
| Provider termination and reconciliation | `reconcileTermination` checks instance/account, terminal state, time cutoff, final cost and invoice evidence; malformed, late, over-limit or non-final evidence is rejected. | Provider-backed stop confirmation, continuing-charge checks, restart/retry behavior and independent reconciliation. |
| Full financial PostgreSQL certification | Disposable PostgreSQL tests cover reservation serialization/caps/rollback and commercial metadata defaults, constraints, foreign keys and replay. The offline drill rejects incomplete concurrency/restart/replay manifests. | Full financial repository coverage, migration upgrade/replay across supported production baselines, crash recovery and replica invariants. No production migration was run. |
| Trusted prepaid payment evidence | `assessPrepaidPayment` requires bound customer/order/account, exact amount, final state, event identity and digest; tamper/reversal/mismatch cases fail. Payment/evidence and reservation suites retain execution denial. | Trusted payment lifecycle adapter, durable atomic event deduplication, ledger credit/reversal proof and independent certification. |

These assessors are offline review tools, not collectors or authorization paths. A caller-generated digest or review record is not a signature or independent evidence. All five blockers remain open in `audit:gpu-execution` until pending external proof is demonstrated.

## Workflow revision assertion

The staging smoke no longer defaults to the historical Phase 18 SHA. It requires `EXPECTED_STAGING_REVISION` or `GITHUB_SHA`, validates the exact 40-character lowercase hexadecimal commit, and compares readiness against it. Manual workflow dispatch uses an explicit input when given and otherwise uses `github.sha`. An offline regression accepts an exact fixture commit, rejects a stale readiness revision against a current expected commit, rejects malformed or missing expectations, and preserves GET-only/authentication checks.

## Workflow verification

The local verification completed on this follow-up:

| Check | Result |
| --- | --- |
| `npm test` | Passed all 39 configured suite entry points. Explicit suite totals include CFO 35/35, zero-funded bootstrap 66/66, provider readiness 230/230, Build 55 34/34, production hardening 77/77 and Build 57 32/32. Phase 18 staging/auth, lead qualification, commercial evidence, supplier diagnostics/billing, owner route guards and the new stale-revision regressions passed. |
| `npm run typecheck` / `npm run lint` | Both passed (`tsc --noEmit`). |
| `npm run security:check` | Passed tracked-file security checks. |
| `npm run test:purchase-boundary` | Passed; legacy purchase blocked before provider calls. |
| `npm run test:phase16-postgres` | Passed with an isolated password-authenticated disposable PostgreSQL cluster; wrong password rejected, reservation concurrency/caps/rollback and commercial schema constraints/replay passed, then the cluster stopped. |
| `npm run build` | Passed. Existing Vite warning remains for the 765.98 kB client chunk; server bundle is 1.3 MB. |
| `npm run audit:gpu-execution` | Expected strict exit 1: 13 safety controls passed, zero failed, five pending commercial certification blockers. |
| `git diff --check` | Passed. |

The full offline workflow checks customer discovery and lead qualification, quote/commercial evidence, read-only supplier diagnostics, owner authentication, financial simulation lockdown, database isolation and production build. No live discovery, supplier transaction, payment, withdrawal, production migration or deployment was part of these checks.

The first hosted PR run exposed that GitHub supplies `GITHUB_SHA`, so the missing-revision test had accidentally exercised the valid workflow fallback. The regression now clears and restores both revision environment variables for its missing-input case and separately asserts that the workflow SHA fallback rejects stale readiness. The complete suite passed locally again with `GITHUB_SHA` set to mimic CI; hosted checks are being rerun on the updated PR head.

## Render status (read-only inspection)

The primary Render service remains on `security/phase18-staging-verification`; its live commit is `2482877c3a2221a7eabc5c8da42db67c440268ca`. A separate `gpu-arbitrage-simulation-staging` service is configured on `main` and is live at PR #42 merge `388339d59733f026d46d22fdf5bcb75c90ae9c5f`. Both settings were read only; this follow-up branch was not deployed and no Render configuration was changed. The existing main-linked staging auto-deploy behavior may deploy a later main merge; no deploy was triggered from this branch.
