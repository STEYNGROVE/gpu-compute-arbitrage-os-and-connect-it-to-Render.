# Provider certification

| Provider | Read-only implementation | Authentic account evidence | Capacity | Live adapter/cancellation |
| --- | --- | --- | --- | --- |
| Vast.ai | current user + fixed POST offer search, TLS/DNS/body/deadline bounds | NOT_VERIFIED; no authorized credential in process environment | NOT_VERIFIED; catalog only | Disabled, not certified |
| RunPod | GraphQL myself + gpuTypes, same transport bounds and process-local rate/circuit guard | NOT_VERIFIED; no authorized credential in process environment | NOT_VERIFIED; stock is advertisement | Disabled, not certified |
| Other existing providers | Preserved legacy integrations | Not independently collected | NOT_VERIFIED | No newly enabled purchasing capability |

The owner's environment has no VAST/RUNPOD/GROQ/RENDER credential variables available to this process. No local secret file was opened to discover credentials. Render connector exposes no names-only environment read operation; provider environment inventory remains an owner dependency. A connected Render account is not supplier API authorization.

Snapshots bind expected account before querying offers, retain API version/endpoints/auth method/time/expiry/raw-response digest and advertise missing minimum billing/storage/network/region/auto-charge facts as null or NOT_VERIFIED. They round advertised cost upward but do not authenticate stock reservation. Generic provider-contract review requires explicit complete fields and account/region allowlists, yet remains recorded-contract-only. Signature/receipt archive does not elevate a caller-provided origin to independent proof.

Reviewed official references on 2026-11-12: [Vast offer search](https://docs.vast.ai/api-reference/search/search-offers) documents the implemented fixed endpoint/query. [RunPod official GraphQL examples](https://github.com/runpod/docs/blob/main/sdks/graphql/manage-pods.mdx) describe gpuTypes/lowestPrice stock and price fields. GraphQL spec direct retrieval returned 403; actual account API/version and Bearer-header compatibility remain live acceptance dependencies. Examples are recorded contract shapes, not captured authenticated provider traffic.

Termination keeps durable intent, retry ceiling/backoff, unknown/orphan/still-billing quarantine and final-invoice requirements inherited from Phase 20. Phase 21 adds lease/fence primitives and independent receipt review, not a running termination daemon. Storage/network charge itemization, final invoice delivery after stop, provider outages/restarts and actual fee cessation need separately authorized provider-backed certification. Cancellation requests are prohibited in this task.

Next owner action: supply read-only scoped credential through approved secret storage and exact expected account, authorize only documented nonmutating collectors, designate independent reviewer and provenance signer. Any future paid lifecycle exercise needs a separate written spend/cancellation authorization, capped disposable resource, emergency operator, invoice reconciliation and independently retained evidence. Do not change VERIFIED based on simulation tests.

CollectorCircuit enforces per-operation in-flight exclusion, 30-second cooldown and 60-second open circuit after three failures; next eligible call is the single half-open probe. State is process-local and resets on restart, so distributed limiting remains a deployment requirement. Injected recorded transports exercise a separately unit-tested circuit without consuming live quotas.
