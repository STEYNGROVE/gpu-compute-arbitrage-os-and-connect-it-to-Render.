# Current Phase 25 blocker and safe next action

Continuation of the saved investigation; no speculative TLS workaround or application-code change was made in this follow-up. Existing staged repairs and the original patch stash are preserved. Render access remains read-only. No push, merge, deployment, configuration edit, external migration, payment or financial activation occurred.

## Evidence status

| Requested fact | Verified answer |
| --- | --- |
| Selected staging PostgreSQL endpoint category | **UNKNOWN**. No deployed connection settings are exposed by the available read-only connector. Same workspace/region is eligibility for private networking, not proof that it was selected. |
| Exact original Node/PostgreSQL TLS verification error code | **UNAVAILABLE IN ACCESSIBLE LOGS**. Only the application's category `TLS_CERTIFICATE` is retained. |
| DATABASE_SSL_CA configured | **UNKNOWN**. The connector has no environment-read operation. Local environment/fixture settings cannot establish staging settings. |
| Referenced CA file exists/readable in the relevant runtime | **UNKNOWN**. The connector has no runtime file inspection or execution operation. A configured secret-file entry alone would not prove runtime presence. |

A renewed log search from 13 November 07:10 UTC through the query time, with hasMore=false, returned only the same two TLS_CERTIFICATE records at 07:11:18.483154 and 07:12:04.416523. No exact expiry/self-signed/unverifiable-leaf code, DATABASE_SSL_CA presence, DATABASE_CA_UNAVAILABLE or CONFIGURATION_REJECTED record was found in that query. See the prior [timestamped incident evidence](RENDER_READONLY_EVIDENCE.json) for the corresponding instance/revision correlation.

Read-only capability discovery again found metadata/log operations and an environment **update** operation, but no environment-read, connection-info or runtime-shell/file operation. The update operation was not used as a read shortcut. No local Render API key or standard Render CLI credential file was found. No credentials, full connection URLs, hostnames, CA paths or certificate contents are included in this follow-up.

A conditional source inference narrows, but does not close, the CA-file question: secureDatabaseOptions reads and checks nonempty CA input before constructing the pool. If DATABASE_SSL_CA (or a URL CA setting) was selected for the pool that logged the TLS connection failure, that read must have succeeded at construction. An absent/unreadable selected CA file would instead reject configuration. This does not establish that a CA was configured, that its trust was correct, or that the file currently exists. It also depends on correlating the inspected source with the failing artifact.

## Provider policy and supported solution

Render's current PostgreSQL documentation says internal TLS uses self-signed certificates and does not support verify-ca/verify-full. Its internal sslmode=require policy requires encryption but does not satisfy this project's requirement to authenticate the server's certificate and hostname. External connections use Render-managed TLS. These are distinct trust policies; an internal-looking hostname is not evidence of server authentication. [Provider documentation](https://render.com/docs/postgresql-creating-connecting.md).

The safest supported proposal under the current authenticated-TLS requirement is the provider's verified **external** endpoint, with hostname verification, rejectUnauthorized=true, default public roots or an independently approved correct CA, and reviewed network access. This is a proposal, not a claim that the currently selected endpoint is internal or that a change would fix the incident. First establish the actual endpoint/trust defect; correct an expired/incomplete chain or wrong CA if that is the verified cause. Do not disable verification, silently use plaintext, add a hostname-pattern trust exception, or add a custom identity-check override. The local repair keeps authenticated TLS mandatory for every production endpoint.

## Exact remaining blocker

**The failed application's selected endpoint and effective CA/root-store configuration are not observable through the authorized tools, and the deployed logging discarded the original TLS error.code.** Therefore the certificate failure cannot be attributed to Render internal self-signing, an incorrect CA, expiry, incomplete chain or another specific trust defect with independent evidence. Local tests cannot establish those deployed facts.

## Next safe action

An authenticated operator should inspect the staging service's deployment-matched configuration in the Render Dashboard, privately compare its selected primary/fallback destination with the database's provider-issued internal/external endpoints, and report **only**:

- Endpoint category for each selected target: internal, external, or other/unknown.
- DATABASE_SSL_CA configured: yes/no; whether URL-specified CA or additional Node trust configuration applies: yes/no.
- The referenced CA file exists and is readable in the **relevant runtime**: yes/no/unavailable. Confirm the runtime revision; checking the currently served older artifact cannot attest a terminated Phase 25 process's filesystem.
- Exact historical error.code if retained elsewhere. If it was discarded everywhere, it cannot be reconstructed from TLS_CERTIFICATE; obtain provider-side diagnostic evidence or plan a narrowly scoped diagnostic for a future separately authorized release.

Do not share full URLs, hostnames, passwords, CA paths or PEM contents. Do not save changed settings, deploy, run a migration, provision another service or enable financial operations to collect this packet. If the Free service offers no existing runtime inspection channel, record file status as unavailable and obtain provider/operator evidence; do not upgrade or redeploy as an implicit diagnostic step.

The missing packet was requested while the local regression rerun continued. No endpoint category or CA-file existence was invented in its absence.

## Review preparation

The repair branch is `fix/pg-connection-lifecycle-20261113`, based on merged PR #55, with the original local patch retained in its stash. Git author identity is now configured. A single local commit is authorized after successful offline checks and staged-file review. No push, PR creation, merge or deployment is authorized. See [REPORT.md](REPORT.md) and [TEST_RESULTS.md](TEST_RESULTS.md).

The strict commercial audit previously reported 13 safety controls passed, 0 failed, and 5 declared unresolved launch blockers: single purchase-gate integration, trusted balance evidence, provider termination/reconciliation, complete financial database/concurrency/recovery certification, and prepaid payment evidence. This is a commercial release decision, not a claim that regression tests failed. No audit gate was altered to authorize launch.

**Verdict: STAGING VERIFICATION PENDING; commercial launch remains blocked.**
