-- Commercial metadata only; no financial ledger or purchasing mutations.
CREATE TABLE IF NOT EXISTS commercial_verification (
 request_id uuid PRIMARY KEY REFERENCES commercial_quote_requests(id) ON DELETE RESTRICT,
 state text NOT NULL DEFAULT 'UNVERIFIED' CHECK (state IN ('UNVERIFIED','CONTACTED','IDENTITY_REVIEWED','REJECTED')),
 evidence_reference text NOT NULL DEFAULT '',
 review_note text NOT NULL DEFAULT '',
 reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS commercial_quote_evidence (
 id uuid PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES commercial_quote_requests(id) ON DELETE RESTRICT,
 version integer NOT NULL,
 customer_rate_usd_per_gpu_hour numeric(16,6) NOT NULL CHECK (customer_rate_usd_per_gpu_hour >= 0),
 provider_rate_usd_per_gpu_hour numeric(16,6) NOT NULL CHECK (provider_rate_usd_per_gpu_hour >= 0),
 additional_cost_usd numeric(16,2) NOT NULL CHECK (additional_cost_usd >= 0),
 valid_until timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT','ISSUED_RECORDED','ACCEPTANCE_RECORDED','VOID')),
 external_evidence_reference text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(request_id,version)
);
CREATE TABLE IF NOT EXISTS commercial_evidence_audit (
 id bigserial PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES commercial_quote_requests(id) ON DELETE RESTRICT,
 action text NOT NULL,
 before_data jsonb,
 after_data jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commercial_evidence_audit_request_idx ON commercial_evidence_audit(request_id,recorded_at DESC);
