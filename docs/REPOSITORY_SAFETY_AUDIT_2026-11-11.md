# Repository safety audit — 2026-11-11

The release remains simulation-only. Live GPU provisioning, trading, payment settlement and withdrawals remain disabled regardless of LIVE environment settings. No deployment was performed. The working tree was clean at the beginning of this audit.

## Changes

| Files | Repair |
| --- | --- |
| `server/financialLockdown.ts`, `server.ts` | Share the actual HTTP financial blocker with tests; block payment intent/verification and escrow/Binance/bank-deposit webhook writes omitted by the old matcher. Match route casing and trailing slashes. Preserve reads, commercial enquiries and emergency-stop engagement. |
| `server/paymentEngine.ts` | Deny payment creation and settlement with a connected database as well as offline. Retain existing offline error contracts. Direct Binance payment instruction generation also rejects before accessing credentials, network or parameters. |
| `server/payfastProvider.ts` | Prevent direct callers from generating live checkout instructions through the legacy adapter. Signature verification utilities remain available. |
| `server/repositories/demandQuotePaymentRepo.ts`, `server/repositories/operationJobSettlementOutboxRepo.ts` | Guard atomic payment/job settlement before starting any database transaction, including calls bypassing the service layer. |
| `server/treasuryEngine.ts` | Reject vault-to-Binance transfers without balance or ledger mutations. Block vault restoration, which previously defaulted to fabricating $3,200 of capital. |
| `server/verifiedProfitWithdrawalService.ts` | Reject external/internal profit withdrawals before idempotency/database/network work; prevent promotion of historical profit into withdrawable balances during lockdown. |
| `server/providerProvisioner.ts` | Run the simulation guard before the permanent direct-purchase blocker. Both blockers remain; no provider purchase implementation was enabled. |
| `tsconfig.json`, `server.ts` | Include the previously omitted root server and TypeScript scripts in checks. Repair six exposed diagnostics: use the existing active-job accessor and accrued-cost field, retain synthetic-source exclusion with a string membership check, use the defined simulated reserve, and type the audit-chain result with its optional failure field. Live funding readiness now also requires the simulation policy to permit live operations, which it never does. |
| `test/liveFinancialLockdownSuite.ts` | Exercise direct adapters, repositories, provisioning, withdrawal and trading under explicit LIVE settings and a mocked healthy database. Assert zero network/database calls and unchanged capital/ledger state. Exercise 40 HTTP write variants against the real shared middleware and preserve read/enquiry/emergency-stop behavior. |
| `test/binanceAndFloatsTest.ts` | Replace the unsafe expectation that a bookkeeping-only vault transfer succeeds with rejection and unchanged-balance/ledger assertions. |
| `test/productionHardeningSuite.ts` | Require simulation rejection for withdrawals; independently retain tests of unlisted destinations and the mandatory allowlist cooldown. Final result: 77/77. |
| `test/phase23CommercialAndSupplierSuite.ts` | Test the shared production financial blocker instead of a copied matcher. |
| `package.json` | Add `test:simulation-safety` and make it part of `npm test`, including existing policy, boundary, guard and outbox audits. |

All PostgreSQL migration SQL, the migration runner, and `server/pgDatabase.ts` are unchanged. Existing read-only supplier discovery, evidence review, cryptographic verification, commercial intake and simulation calculations remain available. Inbound evidence/invoice allocation is distinct from treasury credit and procurement; its existing no-credit/no-purchase controls were retained.

## Verification

- `npm run typecheck`: passed with expanded server/script coverage.
- `npm run security:check`: passed tracked-file credential checks.
- `npm audit --audit-level=moderate` and `npm audit --omit=dev --audit-level=moderate`: both reported zero vulnerabilities. This is registry advisory coverage, not proof of absence of vulnerabilities.
- `npm test`: passed on the final code, including all payment-adapter guards and the integrated simulation-safety regressions.
- `npm run test:simulation-safety`: passed 16 static boundary/outbox checks, 10 mode-policy scenarios and the new direct-call/HTTP regressions.
- `npm run test:purchase-boundary`: passed. Phase 9 payment-evidence source audit also passed.
- Expanded standalone run: 40 suites exercised. After rerunning the repaired production-hardening suite, 39 pass; `build57NegativeSuite.ts` remains incompatible with the simulation-only configuration (see below). All secure-feed suites, including TLS, DNS pinning, socket, timeout and Node 24-specific behavior checks, passed on the available Node 26.13.0 runtime; this is not a separate Node 24 execution.
- Offline agent-runtime regression: passed classification, unverified-customer and no-external-action assertions.
- Server evidence/authentication tests: 18/18 passed with production authentication settings.
- Isolated PostgreSQL 18.6 prepaid integration: passed schema SQL, public fail-closed behavior, concurrent serialization, duplicate prevention, active-job limit, rollback and recovery. Used a newly initialized local cluster/database on port 55449, then stopped that cluster. No existing database was modified.
- Migration validation-only run: validated all eight source files and left databases untouched. Migration execution against the empty disposable database correctly rejected missing `schema_migrations` before DDL (`MIGRATION_PREFLIGHT_FAILED`). An initial target-address mismatch also failed closed; PostgreSQL returns this address as `127.0.0.1/32`, and the exact expected address was then supplied. No migration safeguards were relaxed.
- `npm run build`: passed. Vite warns that the main frontend chunk is approximately 766 kB minified; bundled server output is approximately 1.2 MB.
- `git diff --check`: passed. No migration-file changes. Temporary TLS fixtures were removed after testing.

## Remaining blockers and limits

`npm run audit:gpu-execution` intentionally exits 1: 13 safety controls pass, zero safety controls fail, and five commercial launch blockers remain. Do not lift the simulation lock to silence this audit:

1. A unified audited, reservation-enforcing purchase gateway is not implemented. Legacy purchase code remains behind permanent blockers.
2. Fresh supplier-balance evidence is not verified end to end for live spending.
3. Provider cost/time termination and reconciliation are not independently proven for live execution.
4. Complete financial-system PostgreSQL concurrency certification remains outstanding. The isolated prepaid reservation test passed, but does not certify every financial transaction or an upgraded production database.
5. The live prepaid customer-payment evidence adapter is not independently proven end to end.

`test/build57NegativeSuite.ts` expects live RunPod authentication, an authoritative account balance and provider usage/invoice evidence, and accepts older funding errors instead of the simulation-lock error. It fails under the required configuration. No credentials were supplied and no live resources were provisioned to satisfy it.

Other historical PostgreSQL suites pin port 55439 and database `gpu_commercial_test`. That port was already occupied; this audit did not access or stop its existing server. Those suites, including actual USDT-ledger integration, were not certified against the newly isolated database. The full migration runner deliberately requires an existing trusted migration history; no baseline restore was supplied for upgrade/replay verification. `autonomousAcidTest.ts` is a live-evidence workflow and was not run with external funding or hardware credentials.

This audit combined repository-wide file/path searches, focused review of execution and financial boundaries, existing security tests and new regressions. It is not a formal proof of every line or a certification of live external integrations. No deployment, production migration, trading, withdrawal or GPU purchase was performed.
