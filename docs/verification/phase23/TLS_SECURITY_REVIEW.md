# Phase 23 PostgreSQL TLS review

**Code policy hardened; live configuration not certified.** PR #49 / f14742f guarded only one adapter and permitted plaintext after matching an internal-looking URL authority. The completed audit at 6f71b7b fixed host query substitution, explicit trust opt-in, TLS/CA precedence and authoritative-pool lifecycle. Phase22 live evidence records certificate failures in staging logs, not the app's exact endpoint/CA. This review preserves the stronger policy and repairs consumers that bypassed it.

## Confirmed defects and repairs

Nine runtime adapters created their own Pools: buyerEvidenceImport, commercialEvidence, commercialIntake, customerIntelligence, gpuHunterX, leadDiscovery, ownerOperations, preapprovedWorkloads and usdtInvoiceLedger. Several independently exempted localhost/Render-looking names from TLS, some let URL SSL parameters override options, and they did not participate in the authoritative DIRECT_URL failover/readiness/shutdown. Eager URL parsing/CA reads could also fail at module import. Independent pools multiplied possible connection usage beyond the authoritative pool's 15-client budget.

All nine now use server/applicationDatabase.ts, which delegates query/acquisition to pgDbService at call time. There is one runtime Pool construction boundary: server/pgDatabase.ts. Thus one TLS/CA policy, initialization/readiness gate, fallback choice, pool error handler and shutdown applies. Optional routes fail unavailable if authoritative storage/schema is missing; they do not connect to alternate or default databases. Tests cover actual route SELECT-only behavior, shared-service outage and static source guard against new independent Pools/runtime DDL. Existing transactions still release PoolClients in finally; no financial write retry is added.

The migration CLI uses a separate **offline**, explicitly authorized Client because the app's missing schema must not prevent an approved future migration. It uses secureDatabaseOptions, has no fallback, performs identity/checksum/advisory preflight before DDL and never imports app bootstrap. It is not a runtime bypass. Its acquisition deadline is five seconds, statement budget 30 seconds and client query budget 35 seconds to permit bounded DDL cancellation/rollback; runtime acquisition/query/statement budgets remain five seconds each.

## Endpoint/trust policy

| Endpoint or request | Result |
|---|---|
| External or unknown remote hostname | Authenticated certificate/hostname-verifying TLS; rejectUnauthorized=true |
| Render-looking hostname without exact trusted host and explicit policy | Verified TLS; shape alone grants no trust |
| Internal exception | Production plus Render marker, DATABASE_INTERNAL_TRANSPORT=render-private-network, exact RENDER_INTERNAL_DB_HOST, narrow single-label name, default/5432 port; no explicit TLS/CA request |
| Explicit sslmode=require/verify-ca/verify-full, ssl=true/1, DATABASE_SSL=true or CA | Verified TLS overrides plaintext exception; weaker modes are strengthened |
| DATABASE_SSL_CA / URL sslrootcert | Read/preserve trusted CA; conflicting paths, empty/missing CA or read failures reject safely |
| insecure sslmode/ssl, NODE_TLS_REJECT_UNAUTHORIZED=0, DATABASE_SSL_REJECT_UNAUTHORIZED=false | Fail closed |
| host/port/options/timeout or unknown/duplicate URL parameters | Reject before driver parsing; authority/limits cannot be substituted |
| Nonproduction loopback fixture | Explicit ssl=false permitted for disposable local tests; production loopback requires TLS |
| DIRECT_URL failover | Authoritative pool drains/clears primary, applies identical transport/schema policy and guards against stale shutdown/results |

Private plaintext explicitly accepts provider network, DNS and environment integrity; it does not authenticate the database server. Hostname matching cannot defeat spoofing/rebinding or environment compromise. No arbitrary Render-looking host is trusted, no global verification setting is changed and no IP pinning/authentication guarantee is invented. Operator review must attest actual same-workspace/region/isolation and host binding, or use an already permitted authenticated external endpoint. Never disable verification to make a self-signed endpoint connect.

Provider references: [private network](https://render.com/docs/private-network.md), [connection documentation](https://render.com/docs/postgresql-creating-connecting), [backup limits](https://render.com/docs/postgresql-backups.md). Private-network and backup references were retrieved during Phase23; fresh connection-page Markdown and HTML retrieval timed out, so the earlier same-day direct reading retained in the Phase22 dossier is historical provider context, not a newly successful fetch. Actual app endpoint and trusted-host configuration remain NOT_VERIFIED.

## Tests and release prerequisites

npm run test:postgres-tls reruns 38 named policy/lifecycle/diagnostic cases, including CA, URL substitution, fallback, unavailable DB, connection timeout and cleanup. npm run test:phase23 adds internal-looking external suffix/unsafe configuration cases, actual legacy route behavior and single-pool adoption. The isolated integration additionally configures PostgreSQL with a generated test certificate, accepts an explicit CA for its matching IP identity, rejects the untrusted certificate and rejects a trusted CA with a wrong hostname. It applies the migration CLI under production TLS policy to the local fixture only, and verifies real query timeout/recovery and identity/no-fallback architecture. No external database/provider is contacted by these tests.

Required live evidence remains: names-only configuration, secret-safe primary/direct endpoint and same-logical-database attestation, exact trusted internal host or approved TLS certificate/CA chain, app database role, connection budget and current candidate revision. Connector-session TLSv1.3 is evidence only for the audit connection; neither app TLS nor credential rotation is inferred. No environment values, database URLs or keys are recorded or changed.
