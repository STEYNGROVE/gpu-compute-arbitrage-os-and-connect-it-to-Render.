# Phase 22 — confirmed workspace, live read-only verification

**Verdict: NO-GO.** User confirmed “Steyn’s workspace” after authorizing all possible work within the earlier safety restrictions. This report replaces the previous workspace-selection blocker with actual read-only metadata and database evidence. It does not authorize changes, deploys, migrations, restores, credential rotation, paid provisioning or financial operations.

No new runtime code defect requiring a different repair was demonstrated in this step. The earlier TLS/pool repairs and backend artifact repair remain proposed/unmerged/undeployed. The live schema incompatibility requires separate database change authorization; readiness is not weakened to bypass it.

## Exact live deployment/configuration observations

Sanitized tool snapshots: [render-metadata.json](render-metadata.json). Source tools: list_services, get_service, list_deploys, get_deploy, list_postgres_instances, query_render_postgres, get_metrics and filtered list_logs, explicitly scoped to the user-confirmed workspace. Unrelated workspace services were excluded from further inspection. Connection credentials, database names/users/URLs, environment values and raw logs are not persisted.

| Setting | Protected service | Simulation staging |
|---|---|---|
| Service ID | srv-dbjif7nlk1mc739bi260 | srv-dbmbgrc9v7es739dl3ng |
| Branch | security/phase18-staging-verification | main |
| Live deploy | dep-dbq5ksjl550s739l4mmg | dep-dbqlo3nf3r2c73fb1h00 |
| Live revision | 2482877c3a2221a7eabc5c8da42db67c440268ca | c9d903330db55892ed2d4f18a2e54524917a85b4 |
| Latest attempt | live protected deploy above | dep-dbqp0rk9v7es73du5rcg, update_failed at 1d450b95e6d1eb79128e407902c53df2818f010e |
| Region / compute | Ohio / Free, one instance | Ohio / Free, one instance |
| Automatic deploy | enabled, commit trigger | enabled, commit trigger |
| Build | npm install && npm run build | npm install && npm run typecheck && npm run security:check && npm run build |
| Start | npm start | npm start |
| HTTP health path | empty; no configured HTTP readiness path | /api/ready |
| PR previews | automatic/enabled | off |

The latest four staging deploy attempts returned update_failed; an older deployment remains live. A failed update does not establish that its candidate revision is serving traffic. The metadata and public revision observations agree on the older live revisions. No f14742f/6f71b7b/fa46aea/3c291da remediation is live according to these snapshots. No deployment was triggered or retried.

Including previews returns two older project previews (PR #2 and PR #5), both Free. No previews corresponding to audit PRs #49–#52 were listed. Automatic previews and automatic branch deploys are configuration risks to consider during future release planning; no setting was changed.

## Severity-ranked confirmed findings and limits

| Severity | Finding / evidence | Required next step |
|---|---|---|
| High | **Live compatibility blocker:** acquisition_leads has no published_at column. Metadata query establishes absence, and the exact candidate runtime SELECT LIMIT 0 fails with MISSING_COLUMN. | Review the existing proposal docs/migration-proposals/20261112_phase19_1_acquisition_publication.sql, baseline/backup/rollback and isolated upgrade evidence, then obtain explicit migration authorization. Do not silently derive publication dates, ignore the requirement or run DDL now. |
| High | **Database expiry/recovery risk:** inspected database is Free-tier and lists expiry 2026-11-27T17:21:10.507676Z; HA off and no read replicas. Managed recovery/logical backups are unavailable for Free under current provider documentation. | Owner must arrange an approved preservation/recovery plan before expiry. No upgrade, dump, restore, storage transfer, new resource or paid change was performed; external backup existence is unknown. |
| High | **Live backend-artifact endpoint exposure remains:** earlier anonymous HEAD evidence returned 200 for server.cjs and server.cjs.map. Proposed repair 3c291da in draft PR #52 is not deployed; exact current metadata still shows older revisions. | Independently review candidate and operational prerequisites. Deployment remains prohibited without separate explicit approval. Source body/credential contents were not downloaded or claimed exposed. |
| High, governance | main branch protection/rulesets were absent in the preceding read-only audit. | Administrator-reviewed protection/check/review policy remains an external change; not modified. |
| Medium/high operational | Staging logs in the latest attempt’s time window contain POSTGRES CONNECTION FAILED with TLS_CERTIFICATE and BOOTSTRAP_FAILED. Log identifiers were allowlisted; raw messages were not persisted. | Verify app endpoint/CA/explicit internal trust policy through approved names-only configuration and secret-safe endpoint attestation. Do not disable certificate verification globally. These are service-window logs, not exclusively attributed to a deploy instance, and they do not prove the exact endpoint or that TLS is the only failure. |
| Medium | Database public IPv4 ingress allowlist includes 0.0.0.0/0. | Review intended external access and least exposure under separate configuration authority. This is an observed allowlist, not proof of unauthorized access. No network rule was changed. |
| Medium | The audit connector’s database role has createdb and createrole, but not superuser or bypass-RLS. | Assess least privilege; connector role is not proven to be the application role. No permissions changed. |
| Medium | Protected service has no HTTP health-check path. Staging readiness took 10.39 seconds on this sample; staging liveness timed out at 12 seconds. | Provider HTTP checks require a successful response within five seconds. Review warm-up/network/dependency behavior and health configuration separately. Client-observed latency can include cold start/network delay; this sample alone does not diagnose the failed deploy. |

The existing migration proposal is already covered by isolated upgrade/reapply/NULL-publication/concurrency/rollback tests in test/phase19AcquisitionPostgresChecks.ts. test/phase21PostgresChecks.ts verifies detection of a wrong published_at type. Those existing local results are retained in the preceding dossiers; no production migration was executed here.

## PostgreSQL evidence — precise scope

The workspace contains one listed database: dpg-dbh2u1l9fdbs73a3qpn0-a, available, Ohio, Free, PostgreSQL major 18, no connection pool, no HA/replicas. **Application-to-database binding remains NOT_VERIFIED:** neither service metadata nor the available tools expose a names-only environment/reference mapping. Same workspace/region, matching migration history and a single listed instance are strong context, not proof that either process’s DATABASE_URL references this database. Report results as the inspected workspace database until binding is attested.

[database-evidence.json](database-evidence.json) retains SELECT-only query text and metadata/checksum results:

- Connectivity succeeded; server_version_num 180006; transaction_read_only=on.
- All 36 tables required by server/pgDatabase.ts are visible in public; zero missing from that expected set.
- Nine schema_migrations rows match all nine locally computed trimmed SHA-256 checksums; zero missing, mismatched or unknown versions.
- acquisition_leads has id/title/source_url/source_feed/discovered_at/status/description; published_at is absent. The exact production schema verifier’s column SELECT LIMIT 0 was rejected for that missing column; no application rows were returned.
- Phase20 simulation journal tables were not present in the inspected column result. They are unapplied simulation proposals and are not a claim that a production gateway exists or a reason to automatically install lab schemas.
- Connector session uses TLSv1.3 with 256 bits. This proves the connector’s negotiated encryption, not the app connection’s endpoint, CA, certificate/hostname verification settings or private-network trust acceptance.
- Connector role flags: superuser=false, createdb=true, createrole=true, bypassrls=false. App role privileges remain unknown.

The first get_postgres detail call returned a server error; database list metadata and subsequent SELECT queries succeeded. That tool error is retained as a limitation, not diagnosed as database unavailability. Metrics were read only; connection counts do not establish full workload capacity certification.

**Checksum success is not schema compatibility or financial certification.** The publication proposal is outside automatic migration registration, so its absence is compatible with all registered migration checksums matching. The missing column still blocks the proposed production startup. Stored history can be rewritten by privileged administrators; no external immutable history attestation, full financial-ledger certification or recovery proof was obtained.

## Health, credentials and remaining evidence

Fresh public GET results are in [public-health.json](public-health.json). Protected /api/health and /api/ready returned 200; ready reports revision 2482877c3a2221a7eabc5c8da42db67c440268ca and connected. Staging /api/health timed out, followed by /api/ready 200 at c9d903330db55892ed2d4f18a2e54524917a85b4 after 10.39 seconds. These point-in-time observations do not certify continuous availability or newer code.

Required environment names remain documented in the Phase22 report. **Actual names-only deployed variable inventory, TLS/internal-host policy, primary/fallback logical identity, app database binding and credential-rotation evidence remain unverified.** No names-only environment read capability is exposed, and no secret-value API or update call was used as a workaround. Metadata updatedAt is not credential-rotation proof. No credentials were rotated or tested by attempting login, and no customer/API-key table contents were queried.

All five commercial certification blockers remain PARTIAL/OPEN. Database schema/history observations narrow one part of the baseline gap but do not certify the complete financial ledger, payment adapter, provider balances/capacity, gateway or billing cutoff. Bounded Drive searches in the earlier follow-up established no relevant independently verified packet. No customer/payment/provider fact is invented or upgraded by this report.

## Required review sequence — no actions executed

1. Preserve and review existing data/recovery evidence before the database expiry; name the accountable owner/DBA. Do not provision or upgrade paid infrastructure without separate approval.
2. Obtain names-only configuration plus secret-safe endpoint/role/primary-fallback binding attestation through approved access; distinguish private-network trust from authenticated TLS. Confirm any exact trusted internal host against provider metadata without publishing connection URLs.
3. Independently review the existing acquisition publication migration, exact local SQL/checksum, NULL historical dates and rollback strategy on a restored/isolated baseline. **Production migration/DDL still requires explicit separate authorization.** Do not rewrite historical migrations or checksums.
4. Review draft PR #52 and previous audit fixes, candidate CI, HTTP health policy, secrets/rotation and backup compatibility. Any deployment/branch/env/health/network/role change still requires its own explicit authorization. No merge or deployment is performed by this sequence.
5. Obtain independent supplier/customer/billing/payment and professional financial/security packets before any financial release; keep permanent lockdown and emergency stop engaged.

Rollback/recovery remains the earlier reviewed strategy: deployed artifacts/configuration unchanged; no database mutation to reverse. A future application rollback does not restore a database. No destructive down-migration, data extraction, restore, invoice operation, provider cancellation, payment, trading or payout occurred in this verification.

## Reproducibility and verification

This step changes documentation/evidence only. Runtime code, dependencies, CI workflows and migration files are unchanged from 13f84fb. Existing full local regression and final hosted checks at 13f84fb are historical evidence, not rerun claims. JSON validation, tracked-file security scanning and git diff checks are run for this dossier. Read-only results are stored with tool names, scope, exact resource IDs and query text; they contain no connection credentials, financial/customer rows or raw logs. SQL failure is an expected **compatibility failure**, not a successful readiness test.

Official references retrieved during this work: [health check criteria](https://render.com/docs/health-checks.md), [Free database recovery limitations](https://render.com/docs/postgresql-backups.md), [Free service/database limitations](https://render.com/docs/free.md). The confirmed metadata and provider limits justify NO-GO; no permission to override existing restrictions is inferred.

Dossier validation: four evidence JSON files parsed successfully; `npm run security:check` exited 0 after staging the initial dossier; `git diff --cached --check` exited 0. See [validation.json](validation.json) and [security-check.log](security-check.log). Database active-connection metric: 13 samples ranged from 0 to 1; see [connection-metrics.json](connection-metrics.json). This sampled telemetry is not a load/concurrency certification.
