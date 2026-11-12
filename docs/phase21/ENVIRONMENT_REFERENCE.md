# Environment variables — names only

Source-wide names appear in baseline-inventory.json; this is not a deployed-secret inventory. Render tools did not expose a names-only environment read. No secret values were retrieved.

Required discovery profile: NODE_ENV=production, APP_OPERATING_MODE=DISCOVERY_ONLY, STRICT_AUTH_ENFORCEMENT=true, RENDER_GIT_COMMIT (exact deployed 40-character revision); PORT (platform port, validated); DATABASE_URL (secret, PostgreSQL certificate verification mandatory). OWNER_API_KEY, CUSTOMER_API_KEY, ESCROW_SIGNING_SECRET, QUOTE_LOCK_SECRET, AUDIT_CHAIN_SECRET must be distinct strong backend secrets. DATABASE_SSL_CA may identify a locally mounted trusted CA; DATABASE_SSL enables verified TLS outside production. DIRECT_URL is optional fallback and must receive the same trust/privilege review.

Forbidden release settings: GPU_PURCHASING_ENABLED=true, GPU_EVIDENCE_VERIFIER_READY=true, any DB_MIGRATION_EXECUTE, NODE_TLS_REJECT_UNAUTHORIZED=0, DATABASE_SSL_REJECT_UNAUTHORIZED=false, ENABLE_STUDIO_AUTH_FALLBACK=true, ALLOW_PREVIEW_SESSION=true and frontend VITE_* secret-like variables. LIVE flags never override unconditional lockdown.

Discovery optional: LEAD_SOURCE_REGISTRY_JSON (bounded reviewed source registry), legacy LEAD_RSS_FEEDS only when registry absent. Empty registry disables ingestion. Provider/payment/treasury keys are unnecessary and should be absent for discovery production. GROQ_API_KEY is optional only after model/privacy/quota approval; no agent startup requires it.

Isolated tests: NODE_ENV=test, DISABLE_JSON_PERSISTENCE=true, ALLOW_ISOLATED_GPU_DB_TEST=YES, TEST_DATABASE_URL generated exclusively by disposable harness; DATABASE_URL excluded. Never point these tests at production or a shared database. No production .env file should be loaded; explicit development only may load local .env.
