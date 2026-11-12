# AI agent operations

Implemented `server/phase21/agents.ts` exposes 12 roles: Lead Discovery, Customer Evidence, Supplier Intelligence, GPU Pricing, Quotation, Financial Risk, Billing Reconciliation, Security Monitoring, Infrastructure Health, Compliance Review, Customer Delivery Verification and Executive Reporting. Existing Groq integration is preserved; no model call, credential, agent subprocess or autonomous external action is started here.

Each role accepts bounded flat facts plus up to 32 SHA-256 evidence references, validates task identity, enforces one in-flight call and a 30-second per-process cooldown, bounds prompt facts to 4 KiB, optional advisory call to three seconds and output to 4 KiB, and returns a deterministic audit digest. Failures produce DEGRADED advisory output; no infinite retry. All output requires human review, `evidenceVerified=false`, `financialExecutionAllowed=false`, `externalActionsAllowed=false`. Untrusted LLM text is never parsed into critical policy.

Permissions are empty by design: the runner has no provider, payment, HTTP client, outreach, DB or filesystem tool capability. Deterministic quotation, receipt, risk and lifecycle modules perform critical validation outside the LLM. Caller must minimize/redact personal and secret inputs before invoking any external model. Groq use requires approved credentials/limits and privacy review; no paid dependency introduced.

Current audit is a result digest, not a durable job scheduler. Durable execution journal, distributed quotas, task idempotency, retry queue/dead-letter store, external model budget enforcement and dashboards are still production integration gaps. Existing agents/registry.json remains a registry, not a claim that these agents are running. No autoactivation flag is provided.

Recovery: after advisory failure owner can retry a new review after cooldown with the original input/evidence digest; never retry an uncertain financial operation. Keep human approvals outside LLM-generated content. Retain recommendations according to approved privacy policy, and independently validate provider/customer facts before any consequential use.
