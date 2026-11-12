# Operations, recovery and remaining owner actions

## Minimum path to public launch

1. Review urgent draft security PR #57 for the confirmed public backend/source-map exposure. Separately authorize its merge/deployment if accepted, then independently verify artifact paths and encoded/Range variants return 404. No merge/deployment was performed. Confirm the Render workspace for read-only audit. Verify current service IDs, configured branches, exact deployed SHA, latest successful and failed deploys, health/readiness, sanitized logs/metrics and actual authorization. The failed historical `1d450b9` deploy cannot be diagnosed from a Git commit alone.
2. Establish database continuity before the historical November 27 expiry lead: obtain current instance facts, approve durable storage/retention and any fee-bearing upgrade/replacement, then independently verify encrypted backup and recovery. No paid plan was selected or provisioned.
3. Review the isolated combined PR and its exact source/test SHA. Approve merging or deployment separately; neither is performed by this task. Apply production schema changes only after target-identity, checksum, lock, backup and restore preflight and explicit owner authorization. Remove migration execution flags from application runtime configuration.
4. Deploy only the approved immutable revision under the existing branch policy, then verify actual runtime revision, enquiry persistence, owner/customer isolation, TLS, monitoring and restart/recovery. Do not infer rollout from a queued deploy, successful build or green CI.
5. Set operational owners, paging/response expectations, backup RPO/RTO and incident contacts. Confirm account MFA where supported. Main has no legacy branch protection according to the read-only API response; required reviews/checks are recommended governance hardening, not silently changed here.

## Incident and rollback procedure

On unknown payment, supplier state, reconciliation discrepancy, stale quote or database outage: retain financial lockdown, stop discovery if required through the owner route, preserve the immutable records and pause commercial commitments. Do not retry a purchase or settlement with an uncertain result. Reconcile external event IDs, quote/funding expiry, database state and provider bills through separately authorized read-only sources. Capture only bounded error categories and hashes in incident reports, never credentials/customer payloads.

No production restart or rollback was attempted. A service rollback does not roll back the database or provider effects. These migrations are additive and reject incompatible data; prior query compatibility is exercised in isolated tests. Before any rollback, verify the target binary still accepts current history/schema, restore a synthetic/sanitized copy when permitted and select a compatible forward fix or an approved restore to a new database. Never drop new tables or delete history to make an old release start.

The local journal's stranded lock is fail-closed. Investigate active writers and chain integrity before manual recovery; do not delete records or clear a lock blindly. Free ephemeral storage is not a backup. A committed-head file would not replace external anchoring. For continuity failures, preserve the existing database and original encrypted backup until independently validated recovery and owner acceptance.

## External permission diagnosis

GitHub read access and owner-admin repository access work; existing git/gh authentication can push a separate branch and create PRs. Connector branch/PR writes previously returned “Resource not accessible by integration.” Main's unprotected status and successful CLI writes rule out branch protection and repository ownership as the observed cause; working connector reads do not indicate expired authentication. Exact app installation grants are not exposed, so missing Contents/Pull requests write or operation-specific connector scope cannot be distinguished conclusively. Minimum connector fix, if desired: approve the app installation for this repository with Contents write and Pull requests write. No personal token should be pasted into chat or logs. Working git/gh access already removes this as an engineering publishing blocker.

All current mandatory external blockers are listed in blockers.json. No launch gate is waived, and no repeated permission retry is used as a substitute for authorization.
