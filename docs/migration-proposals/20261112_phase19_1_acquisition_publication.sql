-- PROPOSAL ONLY. Not registered with the deployment migration runner.
-- Apply only after independent baseline/upgrade review and separately authorized migration.
CREATE TABLE IF NOT EXISTS acquisition_leads (
  id text PRIMARY KEY,
  title text NOT NULL,
  source_url text NOT NULL UNIQUE,
  source_feed text NOT NULL,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'CANDIDATE',
  CHECK(status IN ('CANDIDATE','REVIEWING','QUALIFIED','REJECTED'))
);
ALTER TABLE acquisition_leads ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE acquisition_leads ADD COLUMN IF NOT EXISTS published_at timestamptz;
-- Historical NULL publication dates intentionally remain unverified. Never backfill from discovery time.
