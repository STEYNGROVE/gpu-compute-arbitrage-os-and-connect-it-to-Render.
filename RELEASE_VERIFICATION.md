# GPU Compute Arbitrage OS — read-only safety release

## Implemented in this package
- All ten provider adapters now reject provisioning and start/stop/restart/terminate operations without contacting supplier APIs.
- All ten provider cost estimators fail closed with `COST_UNVERIFIED` until complete, independently evidenced fees are available.
- The production opportunity ranker no longer identifies Vast.ai or RunPod as executable providers.
- Read-only discovery, supplier pricing inspection, and status queries are preserved.
- `scripts/read-only-provider-guard.cjs` statically verifies all ten provider methods and the production executable-provider guard.

## Verified
- Static read-only provider guard: passed.
- Source modifications and ZIP packaging: completed.

## Not verified
- Full npm dependency installation timed out in this execution environment. TypeScript, the full test suite, and production build **have not passed for this revision**.
- Live API authentication, deployment, verified customers, revenue, and operational profitability were not tested.
- Pricing records elsewhere in the system may still contain indicative or assumed figures. Never interpret them as executable offers or actual profits.

## Required on the user's Termux checkout
1. Back up the current checkout and extract this package into a fresh folder.
2. Run `npm ci && node scripts/read-only-provider-guard.cjs && npm run typecheck && npm run security:check && npm test && npm run build`.
3. Only deploy read-only staging after all checks pass. Do not enable financial execution, paid provisioning, or trading.
