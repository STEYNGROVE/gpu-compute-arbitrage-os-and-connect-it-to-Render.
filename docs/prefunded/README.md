# Pre-Funded GPU Job Hunter

This release discovers and screens demand without a purchase, bid, lease, signature, transfer, settlement or provider provisioning capability. Owner review never authorizes spending. Existing authentication, simulation boundaries and financial lockdown remain in place. No database migration or Render setting is needed or changed.

## What is implemented

- Independent Akash order/deployment, SAM.gov enterprise RFQ, Vast offer and RunPod catalog adapters, behind a fixed-operation HTTPS transport. Discovery runs only on an authenticated owner's request; there is no spending or background purchasing loop.
- Owner dashboard, immutable application records, chained audit metadata, duplicate opportunity and funding-event prevention, cross-process serialization, persistent one-way discovery stop, source expiry and current-time rechecks before review.
- Complete commercial plan schema and six independently signed evidence categories. An unauthenticated statement, manual import, simulation, catalog price or customer budget cannot establish funding or net profit.
- Integer minor-unit costs, positive net and margin thresholds, explicit reserved customer funding, firm supplier quote, workload feasibility and subcontracting/terms checks. Indicative comparisons replace the rental component with the observed USD hourly price and include every other cost. They always require firm quote and fulfillment evidence before qualification.
- Projected contract revenue uses the committed price, never the maximum procurement budget. Realized revenue is **null / NOT_CONNECTED**, not zero or projected revenue. This module does not post financial ledger entries.

## Official interfaces and actual verification

Documentation was checked on 2026-11-12. See `public-probes-20261112.json` for the original sanitized probe, and `public-probes-latest.json` for the repeat diagnostic with public supplier samples and exact-response mapping checks. Probe data expires and is not a current quote.

| Adapter | Official documentation | Read performed / limits |
| --- | --- | --- |
| Akash | [official market query protobuf](https://github.com/akash-network/chain-sdk/blob/main/proto/node/akash/market/v1beta5/query.proto), [deployment query protobuf](https://github.com/akash-network/chain-sdk/blob/main/proto/node/akash/deployment/v1beta5/query.proto), [node configuration](https://akash.network/docs/developers/deployment/cli/configuration/) | Fixed public REST v1beta5 order/deployment list queries; public endpoint returned HTTP 501. Blocked, no invented fallback data. Compatible public node/version needs verification. A later repeat diagnostic could read the order endpoint (50 returned records, including 48 open GPU records) but deployment discovery still returned HTTP 501; full adapter collection and escrow funding verification remain blocked. |
| Enterprise | [SAM.gov opportunities API](https://open.gsa.gov/api/get-opportunities-public-api/) | Separate authenticated GET, preceding seven UTC days, title GPU, 50-record cap. Credentialed live call not performed. RFQ publication never proves award, payment, duration, subcontracting permission or eligibility. |
| Vast | [official REST interface](https://vast.ai/developers/api) | Only GET `/api/v0/bundles/`, bearer credential, rentable/unrented/verified filters. Credentialed live call not performed. Offer total hourly USD is observed, not a reservation or final all-in contract. |
| RunPod | [official GPU catalog query](https://docs.runpod.io/sdks/graphql/manage-pods) | Fixed GraphQL query only, one GPU in Secure Cloud. Public live read succeeded with 14 priced catalog rows in the original probe and 12 in the repeat diagnostic. Catalog minimums do not prove matching region, uptime, full-duration stock or final price. |

All adapters and schemas have offline fixture tests. No live customer, secured order, escrow balance, supplier eligibility or realized revenue has been verified. Batches are explicitly marked potentially truncated; this is bounded discovery, not an exhaustive market search. Each retains source URL, retrieval time, normalized records and raw-response digest. Raw upstream bodies are not archived; independent collectors must retain the original evidence in a reviewed archive. RFQ titles and open orders remain unverified candidates; absent hardware, currency, price and duration are reported as unknown, not inferred.

[Nosana host requirements](https://learn.nosana.com/hosts/grid.html), [Render operator onboarding](https://rendernetwork.com/participate-node-operators), and [Bittensor mining requirements](https://guides.learnbittensor.org/miners) require network-specific participation. The adapter registry blocks those networks and io.net until official demand interfaces, rental/resale terms and operator-specific eligibility are reviewed. It makes no claim that cloud rentals qualify or that rewards are guaranteed customer contracts.

## Owner API and configuration

All endpoints use existing `requireOwnerAuth`, rate limiting, no-store responses and same-origin checks for browser mutations. Credentials remain server-side. No credential was created, changed or printed. Network errors and invalid bodies cannot echo provider responses or submitted secrets.

- `GET /api/owner/prefunded-hunter`: current qualification, rejected reasons, discovered candidates, wholesale offers, indicative comparisons, approval queue, review records and recent audit metadata.
- `POST .../discover`, body `{"adapter":"akash"}` (or enterprise/vast/runpod). Uses existing `VAST_API_KEY`/`RUNPOD_API_KEY`; enterprise additionally supports an owner-provided `SAM_GOV_API_KEY`. Do not put credentials in browser requests. No credentials were provisioned by this change.
- `POST .../proposals`, body `{ "plan": JobPlan, "evidence": PlanEvidence }`; see exported TypeScript interfaces in `server/prefunded/model.ts`. Unknown fields and unbounded or incomplete inputs fail closed.
- `POST .../review`, body `{ "digest": "<plan SHA256>", "decision": "APPROVE_REVIEW" }` or `REJECT`. Rechecks signatures, source bindings and expiration under archive lock. Only one review and one proposal per opportunity are allowed. Review rejection is terminal in this release; amendments require a separately reviewed revision workflow, not deleting history.
- `POST .../stop`, body `{}`. One-way persistent discovery stop; no HTTP reset exists. Global financial lockdown remains engaged independently.

Non-secret screening configuration: `PREFUNDED_MIN_NET_MINOR` (default 100), `PREFUNDED_MIN_MARGIN_BPS` (default 1000), `PREFUNDED_MAX_EVIDENCE_AGE_MS` (default 300000; maximum 300000). Invalid settings fail closed. Supported plan currencies are USD/EUR/GBP/ZAR, all with two decimal minor units. Costs, funding and committed price must share the same normalized currency. Cross-currency costs require independent FX and slippage review. Catalog comparisons with a non-USD plan return no calculated net until a verified conversion integration exists. No currency peg, tax exemption or free ancillary cost is assumed.

### Evidence protocol

The existing `EvidenceAuthority` verifies Ed25519 receipts using `receiptBytes` and `canonicalFacts` from `server/phase20/evidence.ts`. All six receipts bind `subjectId = plan.opportunityId`, the same customer `accountId`, independent read-only origin, safe source URL, bounded observed/expiry timestamps, and `facts.planDigest = planDigest(plan)`.

| Receipt | Kind | Additional required facts |
| --- | --- | --- |
| contract | CONTRACT | contractuallyCommitted, customerApproved, currency, committedPriceMinor, discoveryDigest matching discovered demand |
| funding | PAYMENT | fundsReserved, fundingState FUNDED or AWARDED, currency, amountMinor covering committed price, globally unique externalEventId; awarded alone never establishes reserved funds |
| requirements | REQUIREMENT | fulfillmentVerified, attesting all plan hardware, per-GPU VRAM, bandwidth, region, duration, uptime and workload obligations |
| eligibility | APPROVAL | eligible, subcontractingPermitted, provider, public termsReference |
| supplier | SUPPLIER | available, priceFirm, offerId, provider, rentalMinor, currency, coveredHours, discoveryDigest matching discovered supply |
| costs | QUOTE | allCostsIncluded, taxReviewed, fxVerified, currency; attests each complete cost assumption in the bound plan |

Every positive boolean above must be true. `SETTLED` and `PAID` describe historical stages and cannot authorize a new fulfillment plan. Insufficient funds, absent firm price, manual evidence, unknown trust, expired quote or missing eligibility blocks qualification. Estimated contingency is still an assumption, not insurance. Risk score is a conservative screening heuristic (25 for evidence-qualified plans, at least 50 for rejected plans), not a calibrated probability or profit guarantee.

**Default startup installs no trusted collectors.** The HTTP caller cannot supply a trust registry. Production qualification remains blocked until independently reviewed collectors, source authentication and public-key trust roots are integrated through the server-owned `EvidenceAuthority` constructor. Tests inject synthetic Ed25519 trust roots only. Those tests demonstrate validation logic; they do not verify an external integration or a customer's funds.

## Archive and operation limits

`data/prefunded-evidence/` is ignored by Git. Records are exclusive-created, fsynced, atomically published, mode 0400, and chained by SHA256. A filesystem lock serializes independent processes; busy locks reject without a memory fallback. Corruption, missing middle records, unwritable storage and stranded crash locks fail closed. Proposals and funding event identifiers cannot be reused, including across different collector issuers. Evidence is reassessed on each dashboard read and approval.

Limits: 128 KiB per archive record, 16 MiB / 2000 records total, 100 proposals; dashboard shows the latest 500 candidates/offers, 10 indicative comparisons per proposal, and last 100 audit entries. Limits stop writes rather than deleting immutable records. Archive rollover and proposal revisions need a reviewed operator workflow.

This is an application append-only archive, **not external WORM storage**. An administrator can truncate an entire tail or replace the filesystem. Durable external anchoring and backups are still required. Render's ephemeral filesystem and multiple independent instances do not provide that durability; do not claim this archive production-certified on either existing service. No disk or deployment setting was changed. Crash lock recovery must inspect and preserve evidence, validate chain integrity and check for active writers before manually removing a stranded lock. A successful write followed by a lost response is an unknown outcome: reload before retrying; never execute a financial action.

## Safest route to the first paying customer

Find a direct enterprise customer for a small, precisely specified batch workload. Confirm their identity and procurement authority; obtain a signed fixed scope, committed price and subcontracting permission. Verify job-specific upfront cleared funds with an independently reviewed read-only payment collector. Obtain a current supplier quote and written fulfillment/resale eligibility for the exact workload, including data handling, SLA, taxes, storage and egress. Bind those records to one plan and confirm positive contingency-adjusted net margin. Have the owner review the complete evidence. This release ends at review: any purchase needs a separate audited execution release, fresh evidence and explicit owner authorization. Deliver, reconcile final supplier costs, and verify paid settlement before recognizing actual revenue.

## Repeat verification and reproducible public probe

Run `npm run probe:prefunded-public` explicitly to make three credential-free reads through the same production transport. It prints a timestamped diagnostic, source URLs, response digests, at most three public supplier samples, and open GPU order counts where the official schema responds. It verifies every normalized RunPod row against the exact response received; it has no example-data fallback. Injected transports in unit tests are explicitly labeled `OFFLINE_INJECTED`, never live observations. This command does not install trust roots, modify the evidence journal, reserve supply, verify funding or activate execution. Read failures are printed as bounded error codes, with no response bodies or credentials.

At 2026-11-12 19:10:56 UTC, the repeat diagnostic returned 12 genuine RunPod catalog rows and 50 Akash order records, 48 marked open with GPU units. These counts are bounded response observations, not exhaustive, independently confirmed or funded opportunities. Akash deployment discovery returned HTTP 501, so the existing all-or-fail Akash adapter cannot complete collection. No escrow read/verification collector exists in this release. Source chain identity/current block freshness, exact escrow coverage across existing obligations, price duration, award and provider eligibility still need independent verification. Zero customer opportunities are qualified as funded; no earnings or completed paid jobs have been established.
