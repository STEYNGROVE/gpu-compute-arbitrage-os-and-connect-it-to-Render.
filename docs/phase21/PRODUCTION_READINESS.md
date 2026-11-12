# Production readiness

Decision: HOLD. Prepared for owner-reviewed discovery-only staging rehearsal, not production deployment. Deployed staging is still Phase 20; new configuration requirements and schema checks have not been rehearsed there. Production service branch was not changed.

| Area | Implemented | Remaining acceptance |
| --- | --- | --- |
| Startup/readiness | Explicit config assessment, completed bootstrap gate, coalesced timeout-bounded DB probe | Actual schema baseline and new profile on authorized staging |
| Transport | Verified DB TLS, normalized URL TLS parameters, fixed public-DNS supplier transport | Provider CA/account verification and ingress inspection |
| HTTP | nosniff, frame denial, no-referrer, permissions policy, production HSTS/CSP, 100 KiB body, port validation | Browser visual/functional CSP rehearsal, ingress/load test |
| Identity | Existing owner-only auth, strict cookies, role separation; preview auto-auth forbidden in production | MFA/SSO upstream integration and recovery procedures are not installed |
| Capacity | Pool max 15, bounded connect/query/statement timeouts | Real workload sizing, connection budget and pooler configuration |
| Lifecycle | No financial workers in discovery bootstrap; idempotent ten-second shutdown | Render signal/drain rehearsal and worker observability |
| Secrets | Values never documented; strict backend config and frontend-secret rejection | Owner rotation, names-only deployed env inventory, external scanner |
| Data | Read-only compatibility checks and checksum planning | Production baseline, least-privilege grants, backup restore and migration approval |

Production deployment intent is in production-manifest.json. It creates no resource, has no production migration command and cannot authorize activation. Recommend existing free staging for rehearsals; do not provision new paid infrastructure.

Environment reference: ENVIRONMENT_REFERENCE.md. Operational actions: RELEASE_AND_ROLLBACK.md. Health check readiness means bootstrap/schema/dependency readiness for this profile, never commercial readiness. Render reported baseline staging live and public ready at c9d9033 on 2026-11-12; this is independent deployment metadata, not provider billing evidence.

Current Render [deploy reference](https://render.com/docs/deploys.md) confirms branch-triggered auto-deploy behavior; [health reference](https://render.com/docs/health-checks.md) documents HTTP readiness. Feature branch pushes do not change the observed main/protected-service branches. No deploy hook or Render mutation was used.

Follow-up GET evidence is retained in staging-read-only-evidence.json: the first readiness request timed out at 15 seconds while health returned 200; a second readiness request returned 200 with database connected and unchanged Phase 20 revision. This is a transient observation, not a diagnosed cause or uninterrupted-availability claim. New readiness deadline behavior is tested locally and not yet deployed.
