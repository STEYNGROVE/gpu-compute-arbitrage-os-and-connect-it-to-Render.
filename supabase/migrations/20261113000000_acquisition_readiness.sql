-- Additive publication metadata; unknown historical publication remains NULL.
CREATE TABLE IF NOT EXISTS acquisition_leads (
 id text PRIMARY KEY,title text NOT NULL,source_url text NOT NULL UNIQUE,source_feed text NOT NULL,
 discovered_at timestamptz NOT NULL DEFAULT now(),status text NOT NULL DEFAULT 'CANDIDATE',
 CONSTRAINT acquisition_leads_status_check CHECK(status IN ('CANDIDATE','REVIEWING','QUALIFIED','REJECTED'))
);
-- PHASE 23 FORWARD-ONLY PROPOSAL. Not registered or executed in production.
-- Execute only inside a separately authorized transaction after baseline/checksum review.
-- Preserve historical unknown publication dates; no backfill, conversion or new index.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $phase23$
BEGIN
  IF to_regclass('public.acquisition_leads') IS NULL THEN
    RAISE EXCEPTION 'PHASE23_BASELINE_REQUIRED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES ('id','text'),('title','text'),('source_url','text'),
      ('source_feed','text'),('discovered_at','timestamp with time zone'),('status','text')) expected(name,kind)
    WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name='acquisition_leads'
      AND c.column_name=expected.name AND c.data_type=expected.kind)
  ) THEN RAISE EXCEPTION 'PHASE23_BASELINE_INCOMPATIBLE'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='acquisition_leads' AND
      ((column_name='published_at' AND (data_type<>'timestamp with time zone' OR is_nullable<>'YES' OR column_default IS NOT NULL))
       OR (column_name='description' AND (data_type<>'text' OR is_nullable<>'YES' OR column_default IS NOT NULL))))
  THEN RAISE EXCEPTION 'PHASE23_COLUMN_POLICY_CONFLICT'; END IF;
END;
$phase23$;

ALTER TABLE public.acquisition_leads ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.acquisition_leads ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE INDEX IF NOT EXISTS acquisition_leads_status_published_idx ON acquisition_leads(status,published_at DESC);
ALTER TABLE acquisition_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON acquisition_leads FROM PUBLIC;
