-- =============================================================================
-- Migration: 20261003000000_autonomous_provider_funding_and_profit_rules.sql
-- Purpose: Versioned PostgreSQL schema migration for:
--          1. Real provider funding events (Vast.ai, RunPod, Lambda external payment proof)
--          2. Autonomous profit allocations (reserve, capital, growth, float, tax, surplus)
--          3. Verified profit attributes (payment provider, PayFast fees, provider billing ref)
-- =============================================================================

-- 1. Real Provider Funding Events (External Payment Proof)
-- Invariant: Internal accounting alone NEVER marks provider funds as externally funded.
CREATE TABLE IF NOT EXISTS provider_funding_events (
  id VARCHAR(128) PRIMARY KEY,
  provider VARCHAR(64) NOT NULL,
  amount NUMERIC(28, 8) NOT NULL CHECK (amount > 0),
  currency VARCHAR(16) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  external_transaction_reference VARCHAR(256) NOT NULL,
  provider_account_id VARCHAR(128) NOT NULL,
  binance_reference VARCHAR(128),
  status VARCHAR(32) NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'SETTLED', 'FAILED', 'REJECTED')),
  reconciliation_result VARCHAR(64) NOT NULL DEFAULT 'RECONCILED',
  funding_type VARCHAR(64) NOT NULL DEFAULT 'PREPAID_CREDIT',
  metadata JSONB,
  audit_hash VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_funding_provider ON provider_funding_events(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_funding_ext_ref ON provider_funding_events(external_transaction_reference);

-- 2. Autonomous Profit Allocations
-- Invariant: Profit after settlement is dynamically allocated based on economics, margins, demand & risk.
CREATE TABLE IF NOT EXISTS autonomous_profit_allocations (
  id VARCHAR(128) PRIMARY KEY,
  settlement_id VARCHAR(128) NOT NULL REFERENCES settlements(settlement_id),
  verified_profit_id VARCHAR(128) NOT NULL REFERENCES verified_profit_records(id),
  total_verified_profit NUMERIC(14, 4) NOT NULL CHECK (total_verified_profit >= 0),
  mandatory_reserve_allocated NUMERIC(14, 4) NOT NULL DEFAULT 0.0000 CHECK (mandatory_reserve_allocated >= 0),
  operating_capital_allocated NUMERIC(14, 4) NOT NULL DEFAULT 0.0000 CHECK (operating_capital_allocated >= 0),
  growth_reinvestment_allocated NUMERIC(14, 4) NOT NULL DEFAULT 0.0000 CHECK (growth_reinvestment_allocated >= 0),
  provider_float_allocated NUMERIC(14, 4) NOT NULL DEFAULT 0.0000 CHECK (provider_float_allocated >= 0),
  fees_tax_reserve_allocated NUMERIC(14, 4) NOT NULL DEFAULT 0.0000 CHECK (fees_tax_reserve_allocated >= 0),
  withdrawable_surplus_allocated NUMERIC(14, 4) NOT NULL DEFAULT 0.0000 CHECK (withdrawable_surplus_allocated >= 0),
  allocation_logic_snapshot JSONB NOT NULL,
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  audit_hash VARCHAR(128) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profit_alloc_settlement ON autonomous_profit_allocations(settlement_id);
CREATE INDEX IF NOT EXISTS idx_profit_alloc_verified_id ON autonomous_profit_allocations(verified_profit_id);

-- 3. Enhance verified_profit_records with payment rail, provider billing, and reconciliation refs
ALTER TABLE verified_profit_records ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(32) DEFAULT 'PAYFAST';
ALTER TABLE verified_profit_records ADD COLUMN IF NOT EXISTS provider_billing_ref VARCHAR(128);
ALTER TABLE verified_profit_records ADD COLUMN IF NOT EXISTS binance_reconciliation_ref VARCHAR(128);
ALTER TABLE verified_profit_records ADD COLUMN IF NOT EXISTS directly_attributable_costs NUMERIC(14, 4) DEFAULT 0.0000;
ALTER TABLE verified_profit_records ADD COLUMN IF NOT EXISTS withdrawal_status VARCHAR(32) DEFAULT 'WITHDRAWABLE';
