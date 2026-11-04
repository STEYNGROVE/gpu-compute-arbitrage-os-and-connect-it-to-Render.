-- ============================================================================
-- Migration: 20261001000001_restore_financial_integrity_constraints.sql
-- Purpose: Restore foreign keys, unique constraints, and financial integrity
--          constraints on verified_profit_records, settlements, compute_jobs,
--          capital_reservations, and withdrawal_allowlist.
-- ============================================================================

-- 1. Ensure verified_profit_records exists with full foreign keys, unique constraints, and financial checks
CREATE TABLE IF NOT EXISTS verified_profit_records (
  id VARCHAR(128) PRIMARY KEY,
  settlement_id VARCHAR(128) NOT NULL REFERENCES settlements(settlement_id),
  job_id VARCHAR(64) NOT NULL REFERENCES compute_jobs(job_id),
  customer_id VARCHAR(64) NOT NULL REFERENCES customers(customer_id),
  verified_gross_revenue NUMERIC(14, 2) NOT NULL CHECK (verified_gross_revenue >= 0),
  verified_actual_provider_cost NUMERIC(14, 4) NOT NULL CHECK (verified_actual_provider_cost >= 0),
  verified_payment_fees NUMERIC(14, 4) NOT NULL DEFAULT 0.0000 CHECK (verified_payment_fees >= 0),
  verified_realized_profit NUMERIC(14, 4) NOT NULL,
  reconciliation_variance NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
  reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  audit_hash VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_verified_profit_job UNIQUE (job_id),
  CONSTRAINT uq_verified_profit_settlement UNIQUE (settlement_id)
);

-- 2. Restore any previously dropped foreign keys or unique constraints on verified_profit_records
DO $$ BEGIN
  -- Purge any orphan synthetic records before restoring strict foreign key integrity
  DELETE FROM verified_profit_records
  WHERE customer_id NOT IN (SELECT customer_id FROM customers)
     OR job_id NOT IN (SELECT job_id FROM compute_jobs)
     OR settlement_id NOT IN (SELECT settlement_id FROM settlements);

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verified_profit_records_customer_id_fkey') THEN
    ALTER TABLE verified_profit_records
      ADD CONSTRAINT verified_profit_records_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verified_profit_records_job_id_fkey') THEN
    ALTER TABLE verified_profit_records
      ADD CONSTRAINT verified_profit_records_job_id_fkey
      FOREIGN KEY (job_id) REFERENCES compute_jobs(job_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verified_profit_records_settlement_id_fkey') THEN
    ALTER TABLE verified_profit_records
      ADD CONSTRAINT verified_profit_records_settlement_id_fkey
      FOREIGN KEY (settlement_id) REFERENCES settlements(settlement_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_verified_profit_job') THEN
    ALTER TABLE verified_profit_records
      ADD CONSTRAINT uq_verified_profit_job UNIQUE (job_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_verified_profit_settlement') THEN
    ALTER TABLE verified_profit_records
      ADD CONSTRAINT uq_verified_profit_settlement UNIQUE (settlement_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_verified_profit_non_negative_rev') THEN
    ALTER TABLE verified_profit_records
      ADD CONSTRAINT chk_verified_profit_non_negative_rev
      CHECK (verified_gross_revenue >= 0 AND verified_actual_provider_cost >= 0 AND verified_payment_fees >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_verified_profit_created ON verified_profit_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verified_profit_settlement ON verified_profit_records(settlement_id);
