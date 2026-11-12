# Five-blocker certification matrix

All five remain PARTIAL. None is CERTIFIED, EXTERNALLY_VERIFIED or a financial launch authorization. Tests validate implemented controls; missing external evidence and technical integrations remain launch blockers.

## 1. Unified GPU purchase gateway

**Original severity:** CRITICAL.

**Final status:** PARTIAL.

**Required controls:** Authoritative gateway; adapters and provider/account approvals; durable idempotency/state/audit; exposure ceilings; expiry/retry/timeouts/circuit; leases/fences/recovery; emergency stop; no bypasses.

**Implemented controls:** Phase 20 serializable simulation journal, digest/key deduplication and caps, atomic audited transitions, uncertain-commit lookup; Phase 21 recorded contract validation, DB-clock simulation leases/fenced transitions, permanent real-execution latch, collector circuit.

**Source references:** [server/phase20/gateway.ts](../../server/phase20/gateway.ts), [server/phase21/workerLease.ts](../../server/phase21/workerLease.ts), [server/phase21/providerContract.ts](../../server/phase21/providerContract.ts), [server/phase21/reconciliation.ts](../../server/phase21/reconciliation.ts), [server/simulationSafety.ts](../../server/simulationSafety.ts).

**Executed test commands:** `npm run test:phase20`, `npm run test:phase21`, `npm run test:phase21-postgres`, `npm run test:purchase-boundary`, `npm run test:simulation-safety`. Exact exits/counts/retries and limits are recorded in TEST_EVIDENCE.md and verification artifacts.

**Independent external evidence:** No live provisioning or independent adapter certification.

**Remaining deficiencies:** No certified live dispatch/authorization integration; optional fencing applies only to simulation callers; legacy implementations retained behind denial; no production journal deployment.

**Residual risk:** Cannot authorize a resource purchase; simulation correctness does not establish provider idempotency.

**Acceptance criteria:** Independent reviewed single live boundary and separately authorized provider-backed duplicate/crash/uncertain-response/exposure tests; no enabled bypass.

## 2. Trusted supplier balances and capacity

**Original severity:** HIGH.

**Final status:** PARTIAL.

**Required controls:** Account-authenticated collectors; hardware/quantity/region/all charges/terms/auto-charge/freshness; signed provenance/rotation/revocation/replay/retention/rate limits; verified independent origin.

**Implemented controls:** Fixed read-only Vast/RunPod operations, pinned TLS/DNS, deadlines/body limits; expected-account snapshot/digest/explicit unknown fields; recorded metadata contracts; Ed25519 validity/revocation and append-only receipt/event archive; circuit/rate control.

**Source references:** [server/phase21/supplierReadOnly.ts](../../server/phase21/supplierReadOnly.ts), [server/phase21/circuitBreaker.ts](../../server/phase21/circuitBreaker.ts), [server/phase20/evidence.ts](../../server/phase20/evidence.ts), [server/phase21/evidenceArchive.ts](../../server/phase21/evidenceArchive.ts), [server/phase20/supplierEvidence.ts](../../server/phase20/supplierEvidence.ts).

**Executed test commands:** `npm run test:phase21`, `npm run test:phase21-postgres`, `npm run test:phase20`, `npm run test:provider-billing`. Exact exits/counts/retries and limits are recorded in TEST_EVIDENCE.md and verification artifacts.

**Independent external evidence:** Official API documentation only; authenticated supplier facts NOT_VERIFIED.

**Remaining deficiencies:** No credential/root configured, independently validated real account/balance/guaranteed capacity, production archive/retention; missing live billing/region/auto-charge fields.

**Residual risk:** Catalog stock is not reserved capacity; default trust empty; production provenance unestablished.

**Acceptance criteria:** Independent authenticated account-bound complete fresh evidence and root governance review; capacity and auto-charge cannot be inferred.

## 3. GPU termination and billing reconciliation

**Original severity:** CRITICAL.

**Final status:** PARTIAL.

**Required controls:** Durable stop intent/ownership/runtime/exposure; workload completion; status/invoice reconciliation; retries/quarantine/orphans/continuing charges; storage/network matching; recovery/alerts/manual escalation.

**Implemented controls:** Persistent Phase 20 stop intent/attempt/backoff and quarantined exposure, final simulated invoice gate; Phase 21 lease/fence primitives, permanent emergency latch, signed billing-review boundary and fault cases.

**Source references:** [server/phase20/termination.ts](../../server/phase20/termination.ts), [server/phase20/gateway.ts](../../server/phase20/gateway.ts), [server/phase21/reconciliation.ts](../../server/phase21/reconciliation.ts), [server/phase21/workerLease.ts](../../server/phase21/workerLease.ts).

**Executed test commands:** `npm run test:phase20`, `npm run test:phase21`, `npm run test:phase21-postgres`. Exact exits/counts/retries and limits are recorded in TEST_EVIDENCE.md and verification artifacts.

**Independent external evidence:** No real cancellation, final provider invoice or continuing-charge cessation proof.

**Remaining deficiencies:** No running independently certified cutoff worker; detailed real storage/network invoice line matching, monitoring alert integration and live outage/restart certification.

**Residual risk:** Acknowledged stop never proves end of billing; uncertainty must retain exposure.

**Acceptance criteria:** Separately authorized provider-backed cutoff/failure/restart/invoice tests and independently reconciled remaining exposure.

## 4. PostgreSQL financial integrity

**Original severity:** HIGH.

**Final status:** PARTIAL.

**Required controls:** Authoritative immutable double-entry ledger, atomic event deduplication, account/asset/minor-unit invariants, reversals/refunds/settlement/prepaid liabilities/revenue policy; roles/backups/replay/restart/replica; baseline migration certification.

**Implemented controls:** Disposable integer double-entry transfer prototype, unique digests, owner/currency/negative-balance controls/full reversal, deferred balancing including later insert; schema/checksum planning, receipt archive, pg_dump/restore rehearsal; legacy financial denial remains.

**Source references:** [server/phase21/ledgerLab.ts](../../server/phase21/ledgerLab.ts), [docs/migration-proposals/20261112_phase21_control_lab.sql](../../docs/migration-proposals/20261112_phase21_control_lab.sql), [server/phase21/migrations.ts](../../server/phase21/migrations.ts), [scripts/phase21MigrationPlan.ts](../../scripts/phase21MigrationPlan.ts), [test/phase21ControlsPostgres.ts](../../test/phase21ControlsPostgres.ts).

**Executed test commands:** `npm run test:phase21-postgres`, `npm run test:phase20-postgres`, `npm run test:phase21`, `npm run plan:phase21-migrations`. Exact exits/counts/retries and limits are recorded in TEST_EVIDENCE.md and verification artifacts.

**Independent external evidence:** Actual disposable local PostgreSQL; no authorized production baseline or independent financial audit.

**Remaining deficiencies:** Prototype is not production ledger; full chart/partial refunds/tax/FX/settlement/out-of-order policy and historical replay/replicas; actual least-privilege roles/production backup restoration/upgrade.

**Residual risk:** Legacy float or simulation journal must never become financial authority by configuration.

**Acceptance criteria:** Independently reproducible complete ledger and restored production-baseline upgrade/roles/recovery certification with accountant/DBA acceptance.

## 5. Independent commercial/payment evidence

**Original severity:** HIGH.

**Final status:** PARTIAL.

**Required controls:** Lawful fresh buyer opportunities; identity/procurement/human approvals; full cost quote; enforceable contract/payment binding/signature/dedup/refund/chargeback/delivery/cost/revenue recognition.

**Implemented controls:** Existing secure discovery/qualification/draft complete-cost quote and cumulative evidence chain retained; Phase 21 event conflict archive, payment-order review, bounded advisory roles and integer assumption model; no collection/posting.

**Source references:** [server/leadDiscovery.ts](../../server/leadDiscovery.ts), [server/phase20/commercialEvidence.ts](../../server/phase20/commercialEvidence.ts), [server/phase20/quotation.ts](../../server/phase20/quotation.ts), [server/phase21/paymentBoundary.ts](../../server/phase21/paymentBoundary.ts), [server/phase21/evidenceArchive.ts](../../server/phase21/evidenceArchive.ts), [server/phase21/agents.ts](../../server/phase21/agents.ts).

**Executed test commands:** `npm run test:phase19`, `npm run test:phase20`, `npm run test:phase21`, `npm run test:phase21-postgres`. Exact exits/counts/retries and limits are recorded in TEST_EVIDENCE.md and verification artifacts.

**Independent external evidence:** No independently verified buyer, contract, payment or earned revenue.

**Remaining deficiencies:** No named production payment webhook/signature lifecycle, complete refund/chargeback integration, genuine contract/delivery/cost/recognition chain, professional legal/tax advice.

**Residual risk:** Fixtures/drafts/LLM statements do not establish demand or money; no operational commercial certification.

**Acceptance criteria:** Independent genuine customer/contract/payment/delivery/cost evidence plus trusted event processing and professional policy review.

