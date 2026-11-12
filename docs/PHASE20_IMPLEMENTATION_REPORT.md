# Phase 20 implementation report

Status: **implemented and tested preparation; not commercially operational**. No real customer, contract, supplier capacity, payment or revenue was established. All five commercial blockers remain open.

## Baseline and scope

Remote main is `610627a493cec69a7ef37d78294a46ac09b11c15`, the merged Phase 19.1 PR #45. GitHub confirms the PR merged at `2026-11-12T04:48:55Z`. Created `feature/phase20-commercial-readiness` directly from that remote commit. Local main, deployment branches, Render configuration and existing CI workflows were not edited. The only original untracked file, `server/commercialLeadFilter.ts.phase19.bak`, remains preserved and excluded from commits.

Reviewed the Phase 19.1 report, inherited Phase 18 consolidation/safety/launch reports, current workflows, financial lockdown, reservation/financial repository boundaries, migration inventory, supplier adapters and discovery/quote/evidence modules. Historical reports/checksums are preserved. This is a targeted source review and reproducible offline verification, not independent certification of every legacy repository or deployed service.

## Implemented and tested

| Source | Functionality |
| --- | --- |
| `server/phase20/gateway.ts` | Provider-independent validation; immutable simulation caps; durable idempotency, row versions, transitions, serialization retries, uncertain-commit recovery, persisted stop attempts and hash-chain audit; unconditional real denial |
| `server/phase20/termination.ts` | Cutoff/billing/resource decision engine; orphan/stale/unknown quarantine, retry/backoff/exhaustion, simulated cancellation only and denied real cancellation |
| `server/phase20/evidence.ts` | Bounded canonical receipts, strict publication/expiry validation, account/subject/kind binding, cryptographic collector attestation and five evidence statuses; manual/simulation can never verify |
| `server/phase20/supplierEvidence.ts` | Hardware/VRAM/count/balance/terms/price/no-auto-charge requirements, per-provider declarations and read-only collector limiter/interface |
| `server/phase20/commercialEvidence.ts` | Explicit six-category revenue transitions requiring cumulative independent evidence; no ledger posting, invoicing or automatic advancement |
| `server/phase20/quotation.ts` | Draft-only integer-cent full-bundle costs, duration, VRAM, utilization, explicit network/storage/operations, fees/taxes/contingency/margin/expiry and minor-unit FX evidence |
| `server/phase20/discoverySources.ts` | Bounded administrative source registry with terms/reviewer/time-limit, duplicate rejection and fail-closed invalid config; explicit legacy-unverified fallback only when registry is absent |
| `server/phase20/routes.ts`, `server.ts` | Authenticated, rate-limited, bounded readiness/gateway/quote previews. No database or provider executor is installed |
| `server/leadDiscovery.ts`, `server/leadQualification.ts` | Primary-key/URL race fix, registry use, publisher deadline screening, explicitly stated GPU requirements, buyer statement/contract clues, evidence digest and human-review/expiry queues |
| Treasury/reservation/settlement repositories, `baseRepo.ts`, `prepaidReservationGate.ts` | Stronger direct financial denial, test-only legacy reservation primitive, sanitized transaction errors and non-enumerable underlying diagnostic errors |
| `server/supplierBalanceReadOnly.ts` | Bounded diagnostic payloads, strict identity/errors, explicitly unverified independent status; credential values never returned |
| `server/commercialEvidence.ts` | Legacy draft expiry uses strict timezone/calendar parsing |

Dedicated Phase 20 model/HTTP/financial/discovery/supplier tests are part of normal `npm test`. `test:phase20-postgres` runs the existing disposable harness, including unchanged baseline reservation/commercial/acquisition checks and the new Phase 20 scenarios. Source/proposal validation does not run the production migration runner.

## Confirmed defects repaired

1. Direct treasury double-entry and capital reservation create/consume/release and direct SETTLED-record insertion calls could reach SQL without their own unconditional simulation guard. They now deny before parameter/database/transaction work.
2. The internal credit-reservation primitive relied on LIVE-style flags and caller-provided numbers. It is now unavailable outside explicit isolated-test mode; the public reservation path remains denied.
3. Balance diagnostics still parsed unrestricted JSON and accepted malformed/whitespace identities and non-array GraphQL errors. Payloads are bounded; those identities/errors reject and the independent evidence status stays unverified.
4. Generic transaction/rollback messages could include underlying SQL details. Public messages are now generic, rollback logs retain only error name/code and underlying diagnostics are non-enumerable.
5. Concurrent acquisition inserts could conflict on the hashed primary key before the URL-targeted conflict handler handled the duplicate. The disposable test reproduced this; `ON CONFLICT DO NOTHING` now handles both constraints without replacing accepted evidence.
6. Legacy commercial quote evidence accepted timezone-free/normalized invalid calendar expiry values. The shared strict validator now rejects them.

Initial development validation also found new-code type/fixture-name issues, an SQL parameter type ambiguity and a PL/pgSQL CASE-parenthesis syntax error. They were corrected, not waived. The new proposal was repeatedly exercised in fresh disposable clusters; failed attempts and subsequent results are retained under `docs/verification/phase20`.

## Configuration and compatibility

`LEAD_SOURCE_REGISTRY_JSON`, when present, must be an array of at most five objects containing `feedUrl`, `termsReference`, `reviewerReference`, `reviewedAt`, `expiresAt`. Feed/terms URLs are public HTTPS references without credentials/query tokens; timestamps need explicit zones and registry review expires within 30 days. Empty array disables configured discovery. Invalid/expired/duplicate registry entries fail closed, without falling back to legacy feeds. When absent, existing `LEAD_RSS_FEEDS` behavior remains, explicitly unverified. These administrative records do not prove publisher permission or buyer identity.

The Phase 20 SQL is an **unapplied proposal**, not registered with runtime migrations. The PostgreSQL gateway has to be explicitly constructed with an injected pool; startup does not do so. The Phase 19.1 acquisition proposal remains unapplied to production. No historical migration was changed and no production database was contacted. Missing production schema remains a deployment dependency, not a reason for lazy runtime DDL.

## Implemented but externally unverified / not implemented

Cryptographic receipts authenticate configured collector statements, not the truth or independence of an unreviewed collector. The default authority has no issuers and uses OFFLINE_TEST mode. Even a mathematically valid test signature remains PARTIALLY_VERIFIED; a simulated/manual receipt remains UNVERIFIED. No production collector, signing credential or trust root was configured. No supplier API was contacted with real credentials.

The gateway is not connected to real dispatch, billing, ledger credit or a production store. The cancellation adapter cannot contact providers. No signed receipt archive, public-key governance/revocation, trusted payment-event adapter, full financial ledger/reversal certification or production baseline upgrade was implemented. These remain explicit dependencies, not claimed resolved by simulation.

See [gateway architecture](PHASE20_GATEWAY_ARCHITECTURE.md), [security audit](PHASE20_SECURITY_AUDIT.md), [commercial matrix](PHASE20_COMMERCIAL_READINESS.md), [test evidence](PHASE20_TEST_EVIDENCE.md) and [dependency register](PHASE20_DEPENDENCY_REGISTER.md).
