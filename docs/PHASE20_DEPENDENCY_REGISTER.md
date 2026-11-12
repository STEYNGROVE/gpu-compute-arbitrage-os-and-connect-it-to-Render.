# Phase 20 unresolved dependencies

No item here authorizes a paid or production action. The next milestone must retain simulation lockdown.

| ID | Dependency | Classification | Evidence needed / next safe action |
| --- | --- | --- | --- |
| G1 | Single real dispatch path | Not implemented; execution prohibited | Independently reviewed dispatch design, complete legacy call-site inventory, durable external idempotency/reconciliation design; do not enable it |
| G2 | Production journal migration/role grants | Blocked by baseline and separate production approval | Known baseline, migration manifest, upgrade/replay/rollback tests and least-privilege role design in a disposable restored schema |
| S1 | Trusted supplier collectors | Implemented interfaces; externally unverified | Account-bound, authenticated read-only responses; documented field semantics; independently reviewed collectors and public-key trust governance |
| S2 | Actual GPU hardware/capacity | NOT_VERIFIED | Model, VRAM, available quantity, provider offer identity, timestamp and independently verified expiry/cost/terms; catalog data is insufficient |
| S3 | Balance/no-auto-charge | NOT_VERIFIED | Independently confirmed account binding, prepaid balance and billing configuration. Existing diagnostic booleans are not authority |
| S4 | Collector rate/transport certification | Partial | New limiter has per-provider cooldown/concurrency/deadline; real implementations still need endpoint/version review and reviewed bounded transport |
| T1 | Provider stop and continuing-charge evidence | External requirement; mutations prohibited here | Separately authorized provider-backed tests, final invoice, resource absence, storage/network continuation, retries and restart proof |
| D1 | Complete financial PostgreSQL certification | Partial | All financial repositories, precision/asset invariants, historical baseline upgrade/replay, event reversal/replay, replica restart and failure certification |
| D2 | Immutable evidence archive | Not implemented in production | Signed receipt retention, key rotation/revocation, external audit anchors, retention/privacy policies and least-privilege deployment |
| C1 | Independent customer identity/procurement/contact | NOT_VERIFIED | Actual independently sourced evidence with lawful contact provenance; no automated outreach |
| C2 | Contract/approval/workload/payment obligations | NOT_VERIFIED | Genuine signed agreement and approvals bound to exact customer/order/workload/price; refs and manual notes do not suffice |
| C3 | Trusted payment/revenue adapter | Not implemented; execution prohibited | Final amount/currency/account/event matching, durable atomic event deduplication, delivery/cost reconciliation, reversal/chargeback handling and independently reviewed revenue policy |
| Q1 | Cost/FX/tax assumptions | Draft-only; externally unverified | Signed or independently reviewed supplier costs, minor-unit FX conversion, storage/network/operating costs, fee/tax policy and capacity dependency |
| A1 | Reviewed opportunity sources | Manual configuration implemented; external proof unavailable | Publisher access/use terms, permission to ingest, reviewer/time-limited registry, real opportunity provenance; no source was invented or certified |
| P1 | Production ingress/secrets/deployment | Prohibited in this task | Separate infrastructure/security approval; no Render configuration, deployment or production migration performed |

Recommended next engineering milestone: **Phase 20.1 — independent read-only collector and evidence-archive certification**. Build deterministic recorded-response/replay tests, key rotation/revocation and receipt retention; exercise complete migration baselines in disposable PostgreSQL; extend deny-before-side-effect coverage for the remaining legacy financial repositories. Obtain separately authorized independent evidence before changing any blocker status. Keep provider mutations, payment collection, outreach and production deployment disabled.
