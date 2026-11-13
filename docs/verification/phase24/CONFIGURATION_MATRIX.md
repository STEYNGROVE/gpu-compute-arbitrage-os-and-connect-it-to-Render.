# Phase 24 TLS and configuration matrix

Decision: **NO-GO until actual binding and configuration are independently attested.** No secret values or connection strings are recorded or changed. Names-only deployed environment inventory is unavailable through the exposed tools; code requirements below are not proof of live configuration.

## Required names and precedence

| Names | Required policy / precedence | Evidence status |
|---|---|---|
| NODE_ENV; APP_OPERATING_MODE; STRICT_AUTH_ENFORCEMENT | production; DISCOVERY_ONLY; true | Code validated; deployed values NOT_VERIFIED |
| RENDER_GIT_COMMIT; PORT | Exact approved artifact SHA; platform HTTP port | Live readiness reports 2482877, not candidate; PORT NOT_VERIFIED |
| DATABASE_URL | Required primary application binding for shared legacy adapters and migration client | Actual service/database binding NOT_VERIFIED |
| DIRECT_URL | Optional runtime failover only, same approved logical database/role/schema and transport policy | Presence/identity NOT_VERIFIED; migration client never falls back |
| SUPABASE_DB_URL; POSTGRES_URL | Core service's lower-priority legacy URL aliases; not substitutes for required DATABASE_URL in shared consumers | Avoid ambiguous release configuration; deployed presence NOT_VERIFIED |
| DATABASE_SSL_CA | Optional readable nonempty trusted CA path, required for a private CA endpoint | Actual file/root/rotation NOT_VERIFIED |
| DATABASE_SSL | true explicitly requires TLS even on accepted internal/local endpoints | Cannot disable external verified TLS |
| DATABASE_INTERNAL_TRANSPORT; RENDER_SERVICE_ID; RENDER_INTERNAL_DB_HOST | Only for explicitly accepted private-network exception; marker render-private-network, platform service marker and exact approved internal hostname | Deployed policy and host NOT_VERIFIED |
| OWNER_API_KEY; CUSTOMER_API_KEY; ESCROW_SIGNING_SECRET; QUOTE_LOCK_SECRET; AUDIT_CHAIN_SECRET | Distinct strong backend secrets (32–512 chars); no placeholder/reuse/frontend exposure | Values neither requested nor inspected; rotation NOT_VERIFIED |
| ENABLE_STUDIO_AUTH_FALLBACK; ALLOW_PREVIEW_SESSION | Must not be true in release | Live NOT_VERIFIED; code rejects unsafe profile |
| DB_MIGRATION_EXECUTE; DB_MIGRATION_TARGET; DB_MIGRATION_TARGET_CONFIRM; DB_MIGRATION_EXPECT_DATABASE; DB_MIGRATION_EXPECT_PORT; DB_MIGRATION_EXPECT_TRANSPORT; DB_MIGRATION_EXPECT_SERVER_ADDRESS | No execute marker in app runtime; offline authorized operator only | No production execution here |
| NODE_TLS_REJECT_UNAUTHORIZED; DATABASE_SSL_REJECT_UNAUTHORIZED | Never 0 / false respectively | Unsafe values rejected |
| GPU_PURCHASING_ENABLED; GPU_EVIDENCE_VERIFIER_READY; paid provider/payment/payout credentials | Activation settings forbidden; paid credentials unnecessary for discovery certification | Permanent execution denial retained; no activation |
| VITE_* | No database/secret/token/password/private/API-key material | Tracked-file scanner passes; actual deployed environment NOT_VERIFIED |
| USDT_DB_SSL | Legacy independent pool option is no longer used as a transport bypass | Shared authoritative policy now applies |

Core selection is explicit override then DATABASE_URL, DIRECT_URL, SUPABASE_DB_URL, POSTGRES_URL, trimmed (server/pgDatabase.ts:39). Shared modules additionally require DATABASE_URL (server/applicationDatabase.ts). Avoid multiple inconsistent aliases. The production validator validates every configured alias. A bad fallback cannot silently downgrade TLS; its identity equivalence still requires operator attestation.

## Endpoint decisions

| Situation | Candidate behavior | Certification |
|---|---|---|
| External/unknown remote host | TLS with rejectUnauthorized=true, platform roots or approved CA; identity/certificate failure rejects connection | Tested; actual endpoint NOT_VERIFIED |
| Exact approved single-label Render internal host, production, Render service marker, port 5432 and explicit private acceptance | Plaintext only if no explicit TLS/CA requirement | Tested exception, not authenticated server identity |
| Render-looking substitute, suffix, different host/port, missing trust config, non-Render runtime | No private plaintext exception; authenticated TLS required or connection fails | Tested |
| Explicit sslmode=require/verify-ca/verify-full, ssl=true/1, DATABASE_SSL=true or CA | Overrides private exception; verified TLS retained; driver URL TLS options removed after policy resolution | Tested, including actual trusted/mismatching certificates |
| sslmode=disable/allow/prefer/no-verify, ssl=false/0, verification disabled globally | Reject before pool creation | Tested |
| Malformed URL, unknown/duplicate URL parameters, conflicting/missing/unreadable CA | Constant diagnostic rejection; no raw URL | Tested |
| Local fixture | Nonproduction loopback plaintext may be used; explicit CA/TLS still wins | Isolated tests only, not a production exemption |

Policy is at server/phase21/configuration.ts:40–81. Accepted URL keys are sslmode, ssl, sslrootcert, application_name; conflicting CA paths reject. Internal hostname comparison is exact and narrow; trailing dots/case/suffix substitutions do not gain plaintext trust. DNS resolution is not pinned or authenticated by hostname matching. A compromised trusted DNS/control plane or injected trusted-host configuration can redirect plaintext. Approval of that residual network trust is mandatory; never describe the hostname as server authentication.

Render documents same-workspace/region private networking and dynamic internal addressing: [private network](https://render.com/docs/private-network). Render internal PostgreSQL can use self-signed TLS, while its documented internal sslmode=require option does not provide the certificate authentication this candidate mandates for TLS: [PostgreSQL connections](https://render.com/docs/postgresql-creating-connecting). Thus an internal endpoint needs either an independently trusted suitable CA/identity or explicit acceptance of the narrow private-network plaintext policy. The candidate never implements rejectUnauthorized=false. Prefer a verified external endpoint when internal identity cannot be authenticated and private trust is not accepted. Ohio co-location of service/database is observed, not proof of binding or trust approval. No sensitive connection-info endpoint was called.

## Pool/startup behavior and finding CFG-01

Only one runtime Pool creation boundary remains (server/pgDatabase.ts:35); nine legacy modules share it. Max 15 connections per process, idle 30s, connect/query/statement 5s; calculate aggregate replicas/previews/workers/offline migration budget against database capacity. Failover drains and replaces the primary, verifies fallback schema, releases clients and guards stale generations. Readiness coalesces probes, bounds the HTTP probe to 2s, performs SELECT-only recovery and returns 503 on schema/config/outage failure (server/readinessHealth.ts:5; pgDatabase.ts:83). Local lifecycle/timeout tests pass; no live failover/outage was induced.

Severity: **High**. Evidence: service metadata and connector SELECT prove only an inspected database plus connector TLS, not application endpoint/role/environment; no names-only environment tool exists. Root cause: deployed binding/CA/private trust and role attestation are absent from accessible evidence. Remediation: approved names-only inventory plus independent binding, endpoint/role/CA and connection-budget attestation; do not supply secrets in reports. Test result: TLS/lifecycle/diagnostics 38/38; isolated actual TLS tests pass. Residual risk: wrong logical fallback database, configuration drift, broad database network/role privileges previously observed, trust-plane compromise. Release decision: **BLOCKED** pending separate live verification and configuration authorization.

Credential rotation remains **NOT_VERIFIED**. Required evidence: independently issued secret-manager/audit version references, issue/rotation/revocation timestamps, scope/role review, old-key rejection and new-key validation without disclosure. Render updatedAt, masked values, CI and a code scan do not prove rotation. No rotation or production environment modification occurred.
