-- GPU buyer evidence review schema
-- Applied exclusively by the versioned migration runner.

CREATE TABLE IF NOT EXISTS gpu_buyer_evidence_review (
    id text PRIMARY KEY, source_url text NOT NULL UNIQUE, source_name text NOT NULL,
    title text NOT NULL, description text NOT NULL, posted_date timestamptz,
    category text NOT NULL, original_category text, reviewed boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  );
