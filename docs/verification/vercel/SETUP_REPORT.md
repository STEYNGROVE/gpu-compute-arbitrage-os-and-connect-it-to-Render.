# Vercel frontend preparation — local review

**LOCAL VERIFICATION ONLY; deployment blocked.** Branch `fix/pg-connection-lifecycle-20261113`, base HEAD `f9e7db170c545dfe3f35a4a46dd2ac25aed1e4b2`. All changes are uncommitted. No push, merge, deployment, Render mutation, database migration/write, payment or financial activation was performed. Existing PR #59 remains draft according to the supplied baseline; no GitHub mutation was issued.

## Routing and authentication

`vercel.json` pins both `/api` and `/api/(.*)` to the approved **Render simulation staging service only**, using HTTPS. No caller-supplied destination, production origin, environment-substituted target, credential injection or TLS override exists. API routes run before filesystem and SPA routing, cover all HTTP methods and set `Cache-Control: no-store`. Upstream failures have no SPA fallback. Then the filesystem serves static assets; GET/HEAD extensionless deep links receive index.html. Missing assets and API paths never become the SPA. The filesystem phase is supported but deprecated in current Vercel documentation; it is used here to make precedence explicit.

Frontend requests are same-origin. Backend production login calls the real authentication service and sets a host-only HttpOnly, Secure, SameSite=Strict cookie (Express default Path=/). No Domain is set. Frontend login/session/logout explicitly use same-origin credentials; other relative fetches use the browser same-origin default. Legacy components may also send owner/customer/session headers from runtime user/session state; no static proxy credentials are supplied. Owner credentials must never be placed in VITE_* variables. Public authentication/health and selected public-intake endpoints are exceptions to owner middleware; registered feature routers retain their own guards. Financial routes remain subject to existing lockdown; exposing routing grants no financial authority.

Local routing tests exercise ordered config matching, exact upstream origin, method/query preservation, API-before-files precedence and SPA exclusions. Source-contract tests cover cookie attributes; actual backend middleware tests cover valid owner cookies, denied customer cookies and revoked owner cookies. These tests are **not Vercel edge emulation**. No real login or write API was called. Hosted header/cookie forwarding, Set-Cookie persistence/clearing, non-cached errors, redirect handling, origin normalization and browser login/logout remain separate authorized-release checks. In-memory sessions are lost on backend restart. Login throttling uses backend peer identity; behavior behind the Vercel proxy needs verification before release, without changing trust-proxy blindly.

References inspected: [Vercel routes](https://vercel.com/docs/project-configuration/vercel-json#routes), [external rewrites](https://vercel.com/docs/rewrites). The initial dedicated /project-configuration/routes URL was unavailable; the current vercel-json reference was retrieved instead.

## Browser artifact and configuration review

The original artifact audit checked filenames only. It now rejects backend/nonstatic artifacts, environment files, source maps, key/certificate files, symlinks, missing index and recognizable sensitive text. Vite additionally checks emitted module graphs for rendered backend modules, Node externals and server-only packages. Browser environment validation allows only the two existing public Supabase names; the URL must be credential-free HTTPS and keys must have an anon JWT role or publishable-key shape. This application currently does not import src/lib/supabase.ts, so no VITE_* configuration is required. Service-role/secret keys and unexpected VITE_* names fail closed without printing their values. Positive/negative tests include sensitive artifact content, environment confusion and CLI nonzero failure.

Artifact inspection found no database connection strings, private-key material, Node runtime imports, private IPv4 endpoint URLs or direct Supabase project endpoint in the emitted JavaScript. Build/module checks exclude backend application code and database/Express/dotenv/GenAI server packages. Pattern checks cannot prove that every possible opaque secret is absent. The existing UI contains public SSH key material, account-specific provider links, one illustrative internal API domain and two localhost curl examples; these are not active fetch targets or private keys. They remain publicly inspectable identifiers, and their owner-approved publication/redaction is a release-review item. No values are reproduced here. Google Fonts remains an external browser dependency. The frontend displays financial controls from the existing application, but these controls confer no authorization and must remain blocked by the backend.

## Bundle size investigation

Baseline JS was 765,984 bytes. All tab components are imported synchronously from App.tsx alongside the shared context, React, Motion and icons. A trial vendor split did not establish a safe useful improvement, so it was removed. Initial size comparisons were confounded by the verifier forcing NODE_ENV=test: the unsplit test-environment artifact was 1,524,921 bytes and the split artifact was 1,523,303 bytes. These must not be compared with the production baseline as evidence that splitting increased production size. The Vercel script now explicitly selects NODE_ENV=production, even when invoked by the isolated verifier; the artifact audit also rejects the development auto-session URL. No lazy mount/import behavior or financial state was changed. The final production build retains the >500 kB performance warning. Tab splitting is deferred until browser interaction and tab-state tests can demonstrate equivalent behavior.

## Remaining release blockers

- No Vercel deployment, platform route-schema/emulator execution or browser session round trip has occurred. Offline routing tests establish the intended contract only. Verify authenticated requests, customer/anonymous denial, expiry/revocation, logout, cache isolation, API failures and deep links through the actual frontend origin after separate release authorization.
- Prior read-only Render investigation (not refreshed by this local frontend task): public ready returned older revision c9d903330db55892ed2d4f18a2e54524917a85b4; latest Phase 25 main deployment 83578e61 failed. Do not infer f9e7db1 is deployed or staging is healthy from local build success.
- Exact failed TLS error code, selected endpoint category, DATABASE_SSL_CA presence and runtime certificate-file existence/readability remain unknown. Only TLS_CERTIFICATE was retained. Preserve authenticated TLS; no arbitrary internal-host trust or verification bypass.
- Prior catalog evidence found all seven commercial tables and 71 required types, but only 9/11 migration-history entries. Commercial prerequisite and immutability entries were absent; inspected evidence tables lacked the relevant user triggers. No migration/history repair has been executed. Readiness for this revision is blocked until reviewed, separately authorized recovery and independent verification.
- Database expiry previously confirmed as 2026-11-27 17:21:10.507676 UTC. Real backup/restore custody and any replacement-target (including a proposed Neon restore) remain unverified. No backup, restore, provisioning or cutover was performed.
- Keep DISCOVERY_ONLY and financialExecutionAllowed=false. Commercial certification remains blocked; no purchasing, payments, escrow settlement or financial workers are enabled by this work.
- Review the public identifiers/examples noted above before publishing this private-owner frontend. The SPA authentication screen does not make its downloadable assets confidential.

## API call inventory

AST inspection found **85 fetch call sites: 49 GET, 35 POST, 1 DELETE**. Two indirect arguments resolve to local /api paths: safeFetchJson(url) is used for command-center summary, provider health/matrix and settlement summary/proofs; sessionEndpoint selects /api/auth/session-token with dev_auto only in nonproduction (the production artifact rejects that URL). No frontend fetch uses the illustrative internal/localhost domains. This is a call-site inventory, not a guarantee that every route exists or that UI claims represent backend certification. All endpoint families require backend authorization and/or their existing public-route exceptions; financial endpoints stay locked down.

| Source | Method | Target expression |
| --- | --- | --- |
| src/App.tsx:86 | GET | `'/api/auth/session'` |
| src/App.tsx:102 | POST | `'/api/auth/login'` |
| src/App.tsx:119 | POST | `'/api/auth/logout'` |
| src/components/AuditLogViewer.tsx:104 | GET | `'/api/ledger/anchor'` |
| src/components/CommandCenter.tsx:68 | GET | `'/api/cfo/command-center'` |
| src/components/CommandCenter.tsx:78 | GET | `'/api/autonomous/status'` |
| src/components/CommandCenter.tsx:100 | POST | `'/api/cfo/acid-test'` |
| src/components/CommandCenter.tsx:122 | POST | `'/api/autonomous/discover'` |
| src/components/CommandCenter.tsx:138 | POST | `'/api/autonomous/deploy'` |
| src/components/CustomerApiPortal.tsx:63 | GET | `'/api/gateways/status'` |
| src/components/CustomerApiPortal.tsx:84 | POST | `'/api/payments/intent'` |
| src/components/GpuComparisonDashboard.tsx:72 | GET | `'/api/owner/gpu-price-comparison-normalized?' + params` |
| src/components/GpuComparisonDashboard.tsx:151 | POST | `'/api/owner/gpu-demand-match'` |
| src/components/Header.tsx:61 | GET | `'/api/cfo/command-center'` |
| src/components/JakeGroveCfoPanel.tsx:159 | GET | `'/api/cfo/command-center'` |
| src/components/JakeGroveCfoPanel.tsx:160 | GET | `'/api/cfo/journal'` |
| src/components/JakeGroveCfoPanel.tsx:161 | GET | `'/api/cfo/traces'` |
| src/components/JakeGroveCfoPanel.tsx:162 | GET | `'/api/cfo/exceptions'` |
| src/components/JakeGroveCfoPanel.tsx:199 | POST | `'/api/cfo/acid-test'` |
| src/components/LiveGpuPriceRouter.tsx:128 | GET | `url` |
| src/components/LiveGpuPriceRouter.tsx:171 | GET | `'/api/providers/lightning/ssh-keys'` |
| src/components/LiveGpuPriceRouter.tsx:192 | POST | `'/api/workloads/route'` |
| src/components/LiveGpuPriceRouter.tsx:220 | POST | `'/api/provisioning/preflight'` |
| src/components/ProviderKeyringPanel.tsx:132 | GET | `'/api/providers/credentials'` |
| src/components/ProviderKeyringPanel.tsx:199 | POST | `'/api/providers/credentials'` |
| src/components/ProviderKeyringPanel.tsx:251 | POST | `'/api/providers/credentials/test'` |
| src/components/ProviderKeyringPanel.tsx:292 | POST | `'/api/providers/custom'` |
| src/components/ProviderKeyringPanel.tsx:327 | DELETE | `/api/providers/custom/${id}` |
| src/components/ReadinessPanel.tsx:133 | GET | `'/api/system/readiness'` |
| src/components/ReadinessPanel.tsx:143 | GET | `'/api/system/attack-test/results'` |
| src/components/ReadinessPanel.tsx:167 | POST | `'/api/system/attack-test'` |
| src/components/TreasuryPanel.tsx:198 | POST | `'/api/treasury/vault/send-to-binance'` |
| src/components/TreasuryPanel.tsx:229 | GET | `'/api/compute/capital'` |
| src/components/TreasuryPanel.tsx:270 | GET | `'/api/treasury/binance/deposit-networks'` |
| src/components/TreasuryPanel.tsx:271 | GET | `'/api/treasury/binance/deposit-history'` |
| src/components/TreasuryPanel.tsx:312 | POST | `'/api/treasury/vault/restore'` |
| src/components/TreasuryPanel.tsx:325 | GET | `'/api/compute/capital'` |
| src/components/TreasuryPanel.tsx:394 | POST | `'/api/treasury/hot-wallet/set-address'` |
| src/components/TreasuryPanel.tsx:432 | GET | `/api/treasury/hot-wallet?network=${encodeURIComponent(net)}` |
| src/components/TreasuryPanel.tsx:450 | GET | `'/api/treasury/hot-wallet/readiness'` |
| src/components/TreasuryPanel.tsx:473 | POST | `'/api/treasury/hot-wallet/emergency-stop'` |
| src/components/TreasuryPanel.tsx:514 | POST | `'/api/treasury/hot-wallet/withdraw-to-binance'` |
| src/components/TreasuryPanel.tsx:551 | GET | `'/api/treasury/profit-withdrawals/status'` |
| src/components/TreasuryPanel.tsx:552 | GET | `'/api/treasury/profit-withdrawals/audit-log'` |
| src/components/TreasuryPanel.tsx:609 | POST | `'/api/treasury/profit-withdrawals/execute'` |
| src/components/TreasuryPanel.tsx:648 | POST | `'/api/treasury/profit-withdrawals/sync-realized'` |
| src/components/TreasuryPanel.tsx:679 | POST | `'/api/treasury/profit-withdrawals/send-to-internal-hot'` |
| src/components/TreasuryPanel.tsx:749 | GET | `'/api/treasury/summary'` |
| src/components/TreasuryPanel.tsx:757 | GET | `'/api/treasury/ledger'` |
| src/components/TreasuryPanel.tsx:787 | POST | `'/api/treasury/reconcile'` |
| src/components/ZeroFundedBootstrapPanel.tsx:69 | GET | `/api/zero-funded/providers${fresh ? '?fresh=true' : ''}` |
| src/components/ZeroFundedBootstrapPanel.tsx:91 | POST | `'/api/zero-funded/owner-mode'` |
| src/context/ArbitrageContext.tsx:202 | POST | `'/api/owner/config'` |
| src/context/ArbitrageContext.tsx:247 | GET | `'/api/opportunities/discover'` |
| src/context/ArbitrageContext.tsx:275 | GET | `'/api/providers/status'` |
| src/context/ArbitrageContext.tsx:290 | GET | `/api/demand?mode=${mode}` |
| src/context/ArbitrageContext.tsx:305 | GET | `'/api/audit/logs?limit=200'` |
| src/context/ArbitrageContext.tsx:351 | GET | `sessionEndpoint` |
| src/context/ArbitrageContext.tsx:366 | GET | `'/api/owner/config'` |
| src/context/ArbitrageContext.tsx:376 | GET | `'/api/compute/capital'` |
| src/context/ArbitrageContext.tsx:392 | GET | `'/api/ledger'` |
| src/context/ArbitrageContext.tsx:417 | GET | `'/api/compute/active-jobs'` |
| src/context/ArbitrageContext.tsx:906 | POST | `'/api/opportunities/approve-big-job'` |
| src/context/ArbitrageContext.tsx:1017 | POST | `'/api/compute/quote'` |
| src/context/ArbitrageContext.tsx:1033 | POST | `'/api/compute/execute-deal'` |
| src/context/ArbitrageContext.tsx:1076 | GET | `'/api/compute/capital'` |
| src/context/ArbitrageContext.tsx:1147 | POST | `'/api/compute/abort-job'` |
| src/context/ArbitrageContext.tsx:1184 | POST | `'/api/compute/settle-deal'` |
| src/context/ArbitrageContext.tsx:1252 | GET | `'/api/compute/capital'` |
| src/context/ArbitrageContext.tsx:1328 | POST | `'/api/demand/create'` |
| src/context/ArbitrageContext.tsx:1373 | POST | `'/api/webhooks/escrow'` |
| src/context/ArbitrageContext.tsx:1437 | GET | `'/api/ledger/verify-chain'` |
| src/context/ArbitrageContext.tsx:1537 | GET | `/api/compute/job-telemetry/${job.id}` |
| src/context/ArbitrageContext.tsx:1570 | GET | `/api/compute/job-telemetry/${job.id}` |
| src/services/providerAdapters.ts:71 | GET | `/api/providers/vast/offers?mode=${mode}` |
| src/services/providerAdapters.ts:152 | GET | `/api/providers/runpod/offers?mode=${mode}` |
| src/services/providerAdapters.ts:238 | GET | `'/api/providers/status'` |
| src/services/providerAdapters.ts:251 | GET | `/api/providers/lambda/offers?mode=${mode}` |
| src/services/providerAdapters.ts:323 | GET | `'/api/providers/lambda/instance-types'` |
| src/services/providerAdapters.ts:328 | GET | `'/api/providers/lambda/instances'` |
| src/services/providerAdapters.ts:333 | POST | `'/api/providers/lambda/launch'` |
| src/services/providerAdapters.ts:342 | POST | `'/api/providers/lambda/terminate'` |
| src/services/providerAdapters.ts:351 | POST | `'/api/providers/lambda/restart'` |
| src/services/providerAdapters.ts:360 | GET | `'/api/providers/lambda/regions'` |
| src/services/providerAdapters.ts:365 | GET | `'/api/providers/lambda/ssh-keys'` |
