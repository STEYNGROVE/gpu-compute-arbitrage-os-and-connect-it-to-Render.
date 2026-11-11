# Phase 18 remote branch audit — 2026-11-11

Baseline: `2482877c3a2221a7eabc5c8da42db67c440268ca`. Audit branch: `integration/phase18-safe-consolidation-20261111`.

Fetched all 41 remote heads with an explicit wildcard refspec; origin normally tracks only phase911. Remote tips were discovered using `git ls-remote --heads origin`. This is a source/history audit, not live financial certification. No remote branch was merged, deployed, reset or deleted. No provider, payment or production database operation was performed.

Counts below are baseline-only/branch-only commits. Divergent history alone does not establish unique functionality: squash merges preserve code without preserving commit identity. Content comparisons and selected source diffs supplement ancestry and patch-ID comparisons. “Superseded” does not claim every historical line is identical.

## Findings and safe selection

1. Preserve Phase 18 as the integration baseline. All other heads lack its final verification commit; none is a ready replacement tree. `main` diverges before the three safety/audit commits, with 35 commits on its side. A normal Git merge would retain many non-conflicting protections; this audit does not claim it automatically deletes every newer guard. Any resolved merge or file replacement must preserve those protections explicitly.
2. Useful unique work is concentrated in the newer main lineage. Prefer reviewing its cumulative feature changes once, rather than repeatedly merging its ancestor feature branches. H100 financial verification remains hardcoded false; quotation outputs remain draft/unverified/non-purchasing. Keep these properties.
3. `financialExecutionPolicy.ts` returns `allowed: true` from caller-supplied verification flags, approval and reservation claims. Its reason explicitly disclaims execution/payout authorization. It is useful as an offline policy candidate only; wiring that result to dispatch or withdrawal would be unsafe. It does not supply durable evidence, idempotency or reconciliation.
4. Current `main` and older branches lack the later unconditional connected-database guards in payment creation/settlement, PayFast instructions, settlement repositories, treasury transfers/restoration and profit withdrawals. Restoring those historical implementations would reopen financial execution; treasury restoration historically fabricated $3,200 capital. Keep `financialLockdown.ts`, rate limiting, strict owner authentication, expanded typecheck and the live-financial regression suite.
5. `security/simulation-lockdown` buyer-evidence initialization regresses the current SELECT-only readiness probe to lazy CREATE TABLE. `integration/main-review` has all seven merge-base-changed files identical to baseline; it supplies no outstanding feature delta. Other owner/Hunter/network branches are older iterations already carried into the baseline, with obsolete financial/test/database behavior.
6. Supplier billing/privacy improvements are worth selective review, but do not copy provider files wholesale: current RunPod supports injected offline transport, rejects GraphQL errors during authentication, and uses stricter identity checks. Preserve these while evaluating Phase 11/12 changes. Commercial evidence adds a migration and authenticated database writes; it is not a purely read-only feature and requires separate disposable-database verification.
7. Historical real GPU code is already in baseline ancestry behind permanent blocks. Branch names such as `development/real-gpu-execution` are not evidence of a unique executable feature or permission to activate it. The five commercial blockers remain open.

## Every remote branch

| Branch | Tip | Behind/ahead | Classification | Evidence / disposition |
| --- | --- | --- | --- | --- |
| `development/real-gpu-execution` | `f45bdf674510` | 53/0 | Incorporated (ancestry) | Reachable from Phase 18; no merge needed. Historical financial code is superseded by current guards. |
| `feature/customer-acquisition-v2` | `b4861d67b787` | 69/0 | Incorporated (ancestry) | Reachable from Phase 18; no merge needed. Historical financial code is superseded by current guards. |
| `feature/customer-intelligence` | `d285f6e9c166` | 68/33 | Incorporated/superseded by content | Owner/discovery functionality already carried into Phase 18; old branch lacks subsequent financial, database and authentication hardening. |
| `feature/financial-execution-safety-gates` | `6e1542991953` | 3/25 | Unique useful candidate; selective integration only | Pure financial policy and quotation planner/API (6e15429, 5335c69, a3e510a), plus dashboard/evidence lineage. Policy booleans are not execution authorization. |
| `feature/gpu-b2b-procurement-discovery` | `90cf5df0cb1b` | 68/43 | Incorporated/superseded by content | Owner/discovery functionality already carried into Phase 18; old branch lacks subsequent financial, database and authentication hardening. |
| `feature/gpu-comparison-dashboard-tests-20261108` | `8515ea2592bc` | 40/3 | Incorporated/superseded by content | Superseded: dashboard/API/tests incorporated and extended by demand matching; old dashboard drops request-race safeguards. |
| `feature/gpu-hunter-x` | `58b13fea6c3d` | 68/34 | Incorporated/superseded by content | Owner/discovery functionality already carried into Phase 18; old branch lacks subsequent financial, database and authentication hardening. |
| `feature/h100-fleet-controller` | `17342a2e1faa` | 3/4 | Unique useful candidate; selective integration only | H100 fleet analysis and tests (505754f, 17342a2); reports unverified finance and all execution controls false. |
| `feature/hunter-unified` | `b9aaf9aed3cb` | 68/35 | Incorporated/superseded by content | Owner/discovery functionality already carried into Phase 18; old branch lacks subsequent financial, database and authentication hardening. |
| `feature/owner-command-centre` | `5450b7039b7b` | 68/31 | Incorporated/superseded by content | Owner/discovery functionality already carried into Phase 18; old branch lacks subsequent financial, database and authentication hardening. |
| `feature/owner-operations` | `6112808400b2` | 68/30 | Incorporated/superseded by content | Owner/discovery functionality already carried into Phase 18; old branch lacks subsequent financial, database and authentication hardening. |
| `feature/phase10-postgres-evidence` | `bb2ec6b83388` | 3/28 | Unique useful candidate; selective integration only | Disposable PostgreSQL audit improvements (aedeb46, bb2ec6b), plus financial policy lineage; does not close full-system certification. |
| `feature/phase11-supplier-balances` | `af514ec0bad1` | 3/32 | Unique useful candidate; selective integration only | Billing validation/privacy/tests (836da6f, da69959, af514ec), plus earlier lineage; Phase 12 follow-up required. |
| `feature/phase6-evidence-engine` | `a413bdbe4f58` | 34/6 | Incorporated/superseded by content | Superseded: evidence engine and auth tests incorporated; old HTTP test lacks current partial-provider failure coverage. |
| `feature/phase8-supplier-intelligence` | `e97d95da1fbf` | 28/0 | Incorporated (ancestry) | Reachable from Phase 18; no merge needed. Historical financial code is superseded by current guards. |
| `feature/phase9-balance-evidence-hardening` | `8673039ec03b` | 24/0 | Incorporated (ancestry) | Reachable from Phase 18; no merge needed. Historical financial code is superseded by current guards. |
| `feature/phase94-payment-evidence` | `70976ab3be3f` | 20/0 | Incorporated (ancestry) | Reachable from Phase 18; no merge needed. Historical financial code is superseded by current guards. |
| `feature/read-only-gpu-comparison-20261108` | `ee64ad75c77f` | 41/1 | Incorporated/superseded by content | Superseded: read-only comparison incorporated and extended. |
| `feature/sales-workspace` | `04532dfc48cd` | 68/32 | Incorporated/superseded by content | Owner/discovery functionality already carried into Phase 18; old branch lacks subsequent financial, database and authentication hardening. |
| `feature/security-hardening-v2` | `9f00ac8ba831` | 68/13 | Incorporated/superseded by content | Superseded HTTPS/feed protections; transport and security tests already present. Old intake/database behavior differs. |
| `feature/space-station-one` | `e7c21b1f121d` | 3/10 | Unique useful candidate; selective integration only | Owner Space Station dashboard (e7c21b1), plus H100/buyer filter. |
| `feature/space-station-v2-intelligence` | `48546a68bf21` | 3/12 | Unique useful candidate; selective integration only | Authenticated intelligence dashboard (48546a6), plus prior Space Station lineage. |
| `feature/space-station-v3-evidence` | `9a4b2f1695a8` | 3/14 | Unique useful candidate; selective integration only | Evidence dashboard (9a4b2f1), plus prior lineage. |
| `feature/space-station-v4-commercial-safety` | `2ddd40528e42` | 3/16 | Unique useful candidate; selective integration only | Commercial safety dashboard (2ddd405), plus prior lineage. |
| `feature/space-station-v5-phase2-commercial-evidence` | `e38542276b29` | 3/20 | Unique useful candidate; selective integration only | Owner commercial evidence API/schema (e385422), plus prior lineage; database writes need isolated migration/auth testing. |
| `feature/space-station-v5-profitability` | `0795428339e0` | 3/18 | Unique useful candidate; selective integration only | Read-only profitability calculator (0795428), plus prior lineage. |
| `fix/buyer-intent-lead-filter` | `465a1158225a` | 3/8 | Unique useful candidate; selective integration only | Buyer-intent filter and qualification tests (d20f358, 7276f43, 465a115), plus H100 lineage. |
| `fix/phase12-billing-evidence-privacy` | `714fd99a52d9` | 3/34 | Unique useful candidate; selective integration only | RunPod billing identity/privacy fix (714fd99) plus all newer main-line features; preserve Phase 18 injected transport tests and stricter authentication. |
| `integration/commercial-gates-20261108` | `63ebcce5054d` | 42/5 | Incorporated/superseded by content | Superseded: all three USDT test files identical; old audit is not the current five-blocker assessment. |
| `integration/main-review` | `3be1cf270a85` | 67/50 | Incorporated/superseded by content | Incorporated by content: all seven files changed since merge base are byte-identical to Phase 18. |
| `main` | `c487b9010605` | 3/35 | Unique useful candidate; selective integration only | Aggregate of H100, buyer filter, Space Station V1–V5, commercial evidence/quotes, pure policy, PostgreSQL audit, supplier billing and Phase 12 privacy. Same cumulative feature patch as Phase 12 branch. |
| `release/verified-readonly-20261108` | `f45bdf674510` | 53/0 | Incorporated (ancestry) | Reachable from Phase 18; no merge needed. Historical financial code is superseded by current guards. |
| `security/phase16-launch-readiness` | `32321cbece4c` | 1/0 | Incorporated (ancestry) | Reachable from Phase 18; no merge needed. Historical financial code is superseded by current guards. |
| `security/phase18-staging-verification` | `2482877c3a22` | 0/0 | Incorporated (ancestry) | Exact baseline. |
| `security/phase9-payment-audit` | `6be20cae8225` | 22/0 | Incorporated (ancestry) | Reachable from Phase 18; no merge needed. Historical financial code is superseded by current guards. |
| `security/phase9-unified-purchase-gate` | `463c6a99d640` | 26/0 | Incorporated (ancestry) | Reachable from Phase 18; no merge needed. Historical financial code is superseded by current guards. |
| `security/phase911-migration-preflight` | `69c4e1dbb466` | 3/0 | Incorporated (ancestry) | Reachable from Phase 18; no merge needed. Historical financial code is superseded by current guards. |
| `security/phase95-payment-replay` | `f73c51b438de` | 14/0 | Incorporated (ancestry) | Reachable from Phase 18; no merge needed. Historical financial code is superseded by current guards. |
| `security/simulation-lockdown` | `1de7d28a5127` | 68/49 | Incorporated/superseded by content | Superseded lockdown/discovery lineage; restores CREATE TABLE in buyer-evidence ready(), lacks later connected-DB payment/treasury/withdrawal guards. |
| `test/advanced-https-security` | `6371ef569639` | 68/11 | Incorporated/superseded by content | Superseded HTTPS transport/TLS/DNS suite already present. |
| `test/final-network-security` | `ca47bc937a31` | 68/26 | Incorporated/superseded by content | Superseded network/security tests already present; old test expectations predate financial lockdown. |

## Verification and resulting state

Current-run baseline verification: Historical Phase 18 staging and PostgreSQL results remain historical; no staging or database verification was rerun for this audit. Remote branch code was inspected, not executed or certified.

Merged branches: none. Excluded from automatic consolidation: all 41 heads; incorporated branches need no merge, useful branches await selective integration, obsolete implementations must not replace current safeguards. No implementation changes were made.

Resulting application commit: `2482877c3a2221a7eabc5c8da42db67c440268ca` (unchanged). No audit commit created. Pull request URL: none; no PR created or pushed.

| Current-run check | Result |
| --- | --- |
| `npm run typecheck` | Exit 0 |
| `npm run test:simulation-safety` | Exit 0; 16 static checks, six policy cases, four runtime cases, connected-DB LIVE zero-side-effect regression and 40 blocked HTTP write variants |
| `npm run test:phase18` | Exit 0; offline certification/discovery/smoke contracts/rate limiting and local authentication/tenant checks |
| `npm run test:purchase-boundary` | Exit 0; rejects before provider calls |
| `npm run audit:gpu-execution` | Expected strict failure (script sets exit 1): 13 controls passed, zero failed, five commercial blockers. Subsequent boundary command passed; combined shell exit is not the audit exit. |

Full npm test, production build, dependency audit, isolated PostgreSQL and deployed smoke were not rerun. Branch candidates have not been tested in combination. The two audit artifacts are left uncommitted for review.
