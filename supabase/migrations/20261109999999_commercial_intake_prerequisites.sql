-- Additive prerequisite for commercial evidence; no data deletion or financial mutation.
CREATE TABLE IF NOT EXISTS commercial_quote_requests (
    id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
    company text NOT NULL, contact_name text NOT NULL, email text NOT NULL,
    workload text NOT NULL, gpu_model text NOT NULL, gpu_count integer NOT NULL,
    hours integer NOT NULL, notes text NOT NULL, status text NOT NULL DEFAULT 'NEW',
    CONSTRAINT quote_request_status_check CHECK (status IN ('NEW','REVIEWING','QUOTED','CLOSED'))
  );

CREATE TABLE IF NOT EXISTS customer_intelligence_leads (
    id uuid PRIMARY KEY, company text NOT NULL, source_url text NOT NULL,
    evidence text NOT NULL, workload text NOT NULL, contact_channel text NOT NULL,
    estimated_gpu_count integer, verified_customer boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'DISCOVERED', created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(source_url,company),
    CONSTRAINT valid_lead_status CHECK (status IN ('DISCOVERED','REVIEWING','QUALIFIED','DISQUALIFIED'))
  );

CREATE TABLE IF NOT EXISTS gpu_hunter_opportunities (
    id uuid PRIMARY KEY, company text NOT NULL, source_url text NOT NULL UNIQUE,
    evidence text NOT NULL, workload text NOT NULL, contact_channel text NOT NULL,
    deadline timestamptz, budget_evidence text, score integer NOT NULL,
    score_reasons jsonb NOT NULL, status text NOT NULL DEFAULT 'DISCOVERED',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT gpu_hunter_status_check CHECK(status IN ('DISCOVERED','REVIEWING','QUALIFIED','DISQUALIFIED'))
  );

CREATE TABLE IF NOT EXISTS preapproved_workload_evidence (
    id uuid PRIMARY KEY, customer_name text NOT NULL, customer_email text NOT NULL,
    workload_description text NOT NULL, evidence_type text NOT NULL,
    evidence_sha256 text NOT NULL, document_reference text NOT NULL,
    issuer_name text NOT NULL, issuer_contact text NOT NULL,
    budget_currency text NOT NULL, approved_budget numeric(18,2) NOT NULL,
    valid_until date, state text NOT NULL DEFAULT 'PENDING_VERIFICATION',
    reviewer text, verification_notes text, verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT valid_evidence_type CHECK (evidence_type IN ('SIGNED_CONTRACT','APPROVED_PURCHASE_ORDER','VERIFIED_PREPAYMENT')),
    CONSTRAINT valid_approval_state CHECK (state IN ('PENDING_VERIFICATION','APPROVAL_VERIFIED','REJECTED')),
    CONSTRAINT positive_budget CHECK (approved_budget > 0)
  );

CREATE INDEX IF NOT EXISTS commercial_quote_requests_status_created_idx ON commercial_quote_requests(status,created_at DESC);
CREATE INDEX IF NOT EXISTS customer_intelligence_leads_status_created_idx ON customer_intelligence_leads(status,created_at DESC);
CREATE INDEX IF NOT EXISTS gpu_hunter_opportunities_status_created_idx ON gpu_hunter_opportunities(status,created_at DESC);
CREATE INDEX IF NOT EXISTS preapproved_workload_evidence_state_valid_idx ON preapproved_workload_evidence(state,valid_until);
ALTER TABLE commercial_quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_intelligence_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE gpu_hunter_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE preapproved_workload_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON commercial_quote_requests,customer_intelligence_leads,gpu_hunter_opportunities,preapproved_workload_evidence FROM PUBLIC;

-- Reject incompatible legacy columns without deleting or rewriting data.
DO $$ DECLARE expected record; BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('commercial_quote_requests','id','uuid'),
    ('commercial_quote_requests','created_at','timestamp with time zone'),
    ('commercial_quote_requests','company','text'),
    ('commercial_quote_requests','contact_name','text'),
    ('commercial_quote_requests','email','text'),
    ('commercial_quote_requests','workload','text'),
    ('commercial_quote_requests','gpu_model','text'),
    ('commercial_quote_requests','gpu_count','integer'),
    ('commercial_quote_requests','hours','integer'),
    ('commercial_quote_requests','notes','text'),
    ('commercial_quote_requests','status','text'),
    ('customer_intelligence_leads','id','uuid'),
    ('customer_intelligence_leads','company','text'),
    ('customer_intelligence_leads','source_url','text'),
    ('customer_intelligence_leads','evidence','text'),
    ('customer_intelligence_leads','workload','text'),
    ('customer_intelligence_leads','contact_channel','text'),
    ('customer_intelligence_leads','estimated_gpu_count','integer'),
    ('customer_intelligence_leads','verified_customer','boolean'),
    ('customer_intelligence_leads','status','text'),
    ('customer_intelligence_leads','created_at','timestamp with time zone'),
    ('gpu_hunter_opportunities','id','uuid'),
    ('gpu_hunter_opportunities','company','text'),
    ('gpu_hunter_opportunities','source_url','text'),
    ('gpu_hunter_opportunities','evidence','text'),
    ('gpu_hunter_opportunities','workload','text'),
    ('gpu_hunter_opportunities','contact_channel','text'),
    ('gpu_hunter_opportunities','deadline','timestamp with time zone'),
    ('gpu_hunter_opportunities','budget_evidence','text'),
    ('gpu_hunter_opportunities','score','integer'),
    ('gpu_hunter_opportunities','score_reasons','jsonb'),
    ('gpu_hunter_opportunities','status','text'),
    ('gpu_hunter_opportunities','created_at','timestamp with time zone'),
    ('preapproved_workload_evidence','id','uuid'),
    ('preapproved_workload_evidence','customer_name','text'),
    ('preapproved_workload_evidence','customer_email','text'),
    ('preapproved_workload_evidence','workload_description','text'),
    ('preapproved_workload_evidence','evidence_type','text'),
    ('preapproved_workload_evidence','evidence_sha256','text'),
    ('preapproved_workload_evidence','document_reference','text'),
    ('preapproved_workload_evidence','issuer_name','text'),
    ('preapproved_workload_evidence','issuer_contact','text'),
    ('preapproved_workload_evidence','budget_currency','text'),
    ('preapproved_workload_evidence','valid_until','date'),
    ('preapproved_workload_evidence','state','text'),
    ('preapproved_workload_evidence','reviewer','text'),
    ('preapproved_workload_evidence','verification_notes','text'),
    ('preapproved_workload_evidence','verified_at','timestamp with time zone'),
    ('preapproved_workload_evidence','created_at','timestamp with time zone'),
    ('preapproved_workload_evidence','approved_budget','numeric')) AS shape(table_name,column_name,data_type)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=expected.table_name AND c.column_name=expected.column_name AND c.data_type=expected.data_type) THEN
      RAISE EXCEPTION 'COMMERCIAL_SCHEMA_INCOMPATIBLE';
    END IF;
  END LOOP;
END $$;

-- Bounds mirror API contracts; incompatible historical values stop for owner review.
DO $$ DECLARE item record; BEGIN
 FOR item IN SELECT * FROM (VALUES
 ('commercial_quote_requests','launch_quote_resource_bounds','gpu_count BETWEEN 1 AND 256 AND hours BETWEEN 1 AND 8760'),
 ('customer_intelligence_leads','launch_lead_resource_bounds','estimated_gpu_count IS NULL OR estimated_gpu_count BETWEEN 1 AND 100000'),
 ('gpu_hunter_opportunities','launch_hunter_score_bounds','score BETWEEN 0 AND 100 AND jsonb_typeof(score_reasons) = ''array'''),
 ('preapproved_workload_evidence','launch_evidence_metadata_bounds','approved_budget > 0 AND approved_budget <= 1000000000000 AND evidence_sha256 ~ ''^[a-f0-9]{64}$'' AND budget_currency ~ ''^[A-Z]{3}$''')
 ) AS checks(table_name,constraint_name,expression)
 LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=('public.'||item.table_name)::regclass AND conname=item.constraint_name) THEN
   EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s)',item.table_name,item.constraint_name,item.expression);
  END IF;
 END LOOP;
END $$;
