# Render read-only TLS investigation — 13 November 2026

Observation: **2026-11-13 08:13:51 UTC**. Workspace explicitly confirmed by the operator: `tea-d71ou663jp1c739fnubg`. Only the specified staging service and PostgreSQL instance were inspected through Render. No deployment, restart, configuration update, migration, payment or financial activation was performed. Local application code and existing regression results were not changed.

Evidence: [sanitized API metadata and timestamped logs](RENDER_READONLY_EVIDENCE.json). Control-plane references: [staging service](https://dashboard.render.com/web/srv-dbmbgrc9v7es739dl3ng), [PostgreSQL instance](https://dashboard.render.com/d/dpg-dbh2u1l9fdbs73a3qpn0-a).

## Verified deployment and instance timeline

| UTC, 13 November | Evidence |
| --- | --- |
| 07:10:27.141860 | Phase 25 deploy `dep-dbrbfos9v7es73a1gjn0` starts for `83578e61cd9265629d0fda311b41aa5c0904e27c`. |
| 07:10:44.147337 | Build log explicitly checks out that SHA on `main`. |
| 07:10:46.949926 | Build selects Node **24.22.1** (default). This is build-platform evidence, not a direct process.version/root-store measurement inside the failing process. |
| 07:11:01.432759 | Build-ended event reports **succeeded**. |
| 07:11:18.278156 | Instance `srv-dbmbgrc9v7es739dl3ng-9qht6` opens HTTP listener on **10000**. |
| 07:11:18.483154 | Same instance logs `[POSTGRES CONNECTION FAILED] TLS_CERTIFICATE`; adjacent BOOTSTRAP_FAILED explicitly records the Phase 25 SHA and `financialExecutionAllowed: false`. |
| 07:11:50.634041 | Render reports a new primary port 10000 and restarts the deploy to update networking. This is provider activity observed in logs, not an action taken by this investigation. |
| 07:12:04.314392 | Instance `srv-dbmbgrc9v7es739dl3ng-m6pbl` opens HTTP listener on **10000**. |
| 07:12:04.416523 | Same instance logs TLS_CERTIFICATE and BOOTSTRAP_FAILED with the same Phase 25 SHA and financial execution false. |
| 07:26:13.130620 | Another npm-start sequence appears for the original `…-9qht6` instance label. No later successful bootstrap for that instance is present in the retrieved interval. |
| 07:29:03.400233 | Deployment metadata finishes with **update_failed**; deploy-ended event reports failed. |
| 07:29:03.719963 | Platform logs **Timed Out**. |
| 07:29:04.402539 | Older deployment `dep-dbqlo3nf3r2c73fb1h00`, revision **c9d903330db55892ed2d4f18a2e54524917a85b4**, is listed **live**, with this updated timestamp. |
| 07:29:14.573839 | Different instance `srv-dbmbgrc9v7es739dl3ng-6pmg7` starts npm. |
| 07:29:19.384349 | That instance listens on **3000**. |
| 07:29:19.668387 | That instance reports REMOTE_POSTGRES (HEALTHY). |
| 07:29:20.569442 | Its legacy bootstrap reports live readiness FAIL-CLOSED. |

The latest deploy remains the failed Phase 25 merge. The separately retrieved live deployment is the Phase 20 merge from PR #46; it is **not** the attempted Phase 25 revision. The healthy port-3000 instance emits legacy dotenv/bootstrap messages absent from the failed Phase 25 instances. Read-only GitHub source inspection at the live SHA confirms that legacy dotenv loading and optional TLS-selection code. This is consistent with the earlier deployment being restored/retained after the failed rollout.

**Attribution limit:** the healthy instance's logs do not contain its exact revision, and the available deploy metadata does not expose an instance-to-SHA join. Therefore its exact per-instance SHA is not directly attested. We can independently establish the live deployment SHA, the healthy instance label, and the older bootstrap behavior, but must label their association as a strong inference. Nothing in that healthy log demonstrates recovery of Phase 25.

Observed deployment elapsed time was about **18 minutes 36 seconds**, including build and the port-networking restart. No configurable timeout value was returned; this duration must not be presented as a verified timeout setting.

## Service and database configuration facts

- Staging service is in **Ohio**, in the confirmed workspace, branch **main**, with **/api/ready** as its health check. It has one free-plan instance, start command `npm start`, and commit-triggered auto-deploy enabled. These were inspected, not changed. Build command runs install, typecheck, security check and build; it contains no migration command. Listener availability did not satisfy readiness for the Phase 25 deployment.
- PostgreSQL `dpg-dbh2u1l9fdbs73a3qpn0-a` is **available**, PostgreSQL major **18**, free plan, Ohio, in the same workspace, no HA/read replicas or managed connection pool.
- **Current expiry is independently confirmed: 2026-11-27T17:21:10.507676Z** (19:21 Johannesburg). This supersedes the earlier historical-only qualification in the continuity packet.
- Same account/region establishes eligibility for internal networking. It does **not** establish that this application actually selected this database or its internal endpoint.
- Database external allowlist currently includes `0.0.0.0/0`. This is a verified exposure requiring least-privilege review before any separately authorized release; it is not the cause of a client certificate trust failure and was not modified.

## TLS finding: verified failure class, unresolved precise cause

The two Phase 25 instances fail certificate verification before successful authoritative database initialization. The inspected application classifier maps four distinct conditions to TLS_CERTIFICATE: certificate expiry, unverifiable leaf signature, self-signed certificate in chain, or a self-signed leaf. A hostname-mismatch error has a separate TLS_HOSTNAME category in that source. Therefore the recorded category supports a chain-trust/validity failure, rather than directly establishing a hostname mismatch, authentication failure, schema failure or port-binding failure.

A focused log search for the exact TLS codes, hostname errors, DIRECT_URL diagnostics and CONFIGURATION_REJECTED returned **zero matching records** for 07:10–07:30 UTC, with hasMore=false. The full unfiltered incident log query also returned hasMore=false. These results do not prove which TLS code occurred; the application intentionally discarded that distinction. There is no observed successful DIRECT_URL recovery.

Render documents self-signed TLS for internal PostgreSQL connections, and Render-managed TLS for external connections. The attempted production code requires certificate verification. Its predecessor can select no explicit TLS when no SSL/CA/cloud-URL trigger is present. Consequently an internal endpoint previously working without authenticated TLS and then failing strict verification is a plausible explanation of the cross-revision behavior. It remains **unproven**, because the actual deployed endpoint and CA configuration are not exposed by the available connector. Other unresolved possibilities include a wrong/incomplete CA, expired certificate or chain, and deployed trust-store differences. [Render PostgreSQL connection/TLS documentation](https://render.com/docs/postgresql-creating-connecting.md).

The available Render tools provide metadata/logs but **no read-environment or container-execution operation**. No Render API key is available to the local process, and the Render CLI is not installed. No credentials were requested, extracted, printed or persisted. No endpoint was guessed from an internal-looking name. Public readiness retrieval failed through the web tool, and a separate bounded 20-second HTTPS GET timed out without an HTTP response; neither result establishes the public endpoint's status or revision.

The observed Node 24.22.1 build selection provides no evidence that an unsupported Node version caused the failure. It also cannot prove which roots/CA files the application actually used. No live certificate subject/SAN, issuer chain, validity dates or SNI/DNS selection was captured. Those details cannot be inferred from the database's availability or an older instance's healthy connection.

## Next read-only evidence and conditional remediation

1. Obtain a **sanitized** configuration attestation from the service's read-only Settings view or an authorized diagnostic source: selected primary/fallback hostname and port, whether the targets are the same logical database, TLS parameter names/modes, whether DATABASE_SSL_CA is present/readable, and custom trust-store settings. Do not copy full URLs, passwords, PEM contents or secrets into the report.
2. Obtain the exact allowlisted TLS error code plus endpoint certificate issuer/SAN/validity/chain-verification metadata and runtime Node/root-store identity for the actual attempted endpoint. A connector database session would verify only that connector's connection, not this application's failed binding, so none was substituted as proof.
3. If the endpoint is internal with a self-signed chain that cannot meet the required CA/hostname verification, propose the provider's full external DNS endpoint with authenticated TLS and maintained roots/approved CA. If the actual issue is wrong CA, expired certificate or incomplete chain, remediate that verified defect instead. Preserve rejectUnauthorized=true in all cases; never accept an internal-looking hostname as authentication.
4. Review/authorize any environment adjustment and subsequent deployment separately. Because auto-deploy-on-commit is enabled on main, **do not push to main or merge merely to investigate**. Do not change the deployment branch or manually retry. Keep the existing local lifecycle/schema repairs for review; this investigation does not prove that deploying them alone fixes the live TLS configuration.

The older instance logs legacy treasury/outbox startup messages and subsequently reports live readiness FAIL-CLOSED. Those messages are not evidence that a payment or purchase executed. They do mean the clean discovery-only worker profile is not independently certified for the currently served older artifact. No worker was started/stopped or financial gate changed by this investigation. Missing legacy payment credentials must not be filled in to bypass startup checks.

**Verdict: STAGING VERIFICATION PENDING.** Certificate verification failure and failed rollout are independently verified; the precise certificate/endpoint defect remains unresolved. A healthy older deployment is not Phase 25 staging certification.
