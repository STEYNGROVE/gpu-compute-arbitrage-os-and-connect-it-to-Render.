-- Prerequisite for 20261110_v5_commercial_evidence. No ledger writes.
-- Existing non-prefix histories require a separately reviewed recovery plan.
CREATE TABLE IF NOT EXISTS commercial_quote_requests (
 id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
 company text NOT NULL, contact_name text NOT NULL, email text NOT NULL,
 workload text NOT NULL CHECK (workload IN ('AI_INFERENCE','AI_TRAINING','RENDERING','DATA_PROCESSING','OTHER')),
 gpu_model text NOT NULL, gpu_count integer NOT NULL CHECK (gpu_count BETWEEN 1 AND 256),
 hours integer NOT NULL CHECK (hours BETWEEN 1 AND 8760), notes text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','REVIEWING','QUOTED','CLOSED'))
);
CREATE INDEX IF NOT EXISTS commercial_requests_created_idx ON commercial_quote_requests(created_at DESC);
CREATE TABLE IF NOT EXISTS customer_intelligence_leads (
 id uuid PRIMARY KEY, company text NOT NULL, source_url text NOT NULL,
 evidence text NOT NULL, workload text NOT NULL, contact_channel text NOT NULL,
 estimated_gpu_count integer CHECK (estimated_gpu_count BETWEEN 1 AND 100000),
 verified_customer boolean NOT NULL DEFAULT false CHECK (verified_customer = false),
 status text NOT NULL DEFAULT 'DISCOVERED' CHECK (status IN ('DISCOVERED','REVIEWING','QUALIFIED','DISQUALIFIED')),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source_url,company)
);
CREATE INDEX IF NOT EXISTS customer_intelligence_created_idx ON customer_intelligence_leads(created_at DESC);
CREATE TABLE IF NOT EXISTS gpu_hunter_opportunities (
 id uuid PRIMARY KEY, company text NOT NULL, source_url text NOT NULL,
 evidence text NOT NULL, workload text NOT NULL, contact_channel text NOT NULL,
 deadline timestamptz, budget_evidence text,
 score integer NOT NULL CHECK (score BETWEEN 0 AND 100), score_reasons jsonb NOT NULL DEFAULT '[]',
 status text NOT NULL DEFAULT 'DISCOVERED' CHECK (status IN ('DISCOVERED','REVIEWING','QUALIFIED','DISQUALIFIED')), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_url)
);
CREATE INDEX IF NOT EXISTS gpu_hunter_created_idx ON gpu_hunter_opportunities(created_at DESC);
CREATE TABLE IF NOT EXISTS preapproved_workload_evidence (
 id uuid PRIMARY KEY, customer_name text NOT NULL, customer_email text NOT NULL,
 workload_description text NOT NULL,
 evidence_type text NOT NULL CHECK (evidence_type IN ('SIGNED_CONTRACT','APPROVED_PURCHASE_ORDER','VERIFIED_PREPAYMENT')),
 evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
 document_reference text NOT NULL, issuer_name text NOT NULL, issuer_contact text NOT NULL,
 budget_currency text NOT NULL CHECK (budget_currency ~ '^[A-Z]{3}$'),
 approved_budget numeric(18,2) NOT NULL CHECK (approved_budget > 0 AND approved_budget <= 1000000000000),
 valid_until date, state text NOT NULL DEFAULT 'PENDING_VERIFICATION'
 CHECK (state IN ('PENDING_VERIFICATION','APPROVAL_VERIFIED','REJECTED')),
 reviewer text, verification_notes text, verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((state='PENDING_VERIFICATION' AND verified_at IS NULL) OR
        (state<>'PENDING_VERIFICATION' AND verified_at IS NOT NULL AND reviewer IS NOT NULL AND verification_notes IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS workload_evidence_created_idx ON preapproved_workload_evidence(created_at DESC);
