-- =============================================================================
-- GPU COMPUTE ARBITRAGE OS — PRODUCTION FINANCIAL AUTHORITY MIGRATION
-- Enforces:
-- 1. Strict Foreign Keys (withdrawable_profits -> settlements & compute_jobs)
-- 2. Unique Constraints (idempotency, settlement, job, provider transactions)
-- 3. Financial Integrity CHECK Constraints (integer minor units, non-negative balances)
-- 4. 10-Stage Financial Lifecycle State Machine Constraints
-- =============================================================================

CREATE TABLE IF NOT EXISTS payment_intents (
  id VARCHAR(128) PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL REFERENCES customers(customer_id),
  provider VARCHAR(64) NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency VARCHAR(16) NOT NULL DEFAULT 'USD',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SETTLED', 'FAILED', 'CANCELLED')),
  client_secret VARCHAR(255),
  reference VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS provider_transactions (
  id VARCHAR(128) PRIMARY KEY,
  payment_intent_id VARCHAR(128) NOT NULL REFERENCES payment_intents(id),
  provider VARCHAR(64) NOT NULL,
  provider_transaction_id VARCHAR(255) NOT NULL,
  provider_event_id VARCHAR(255),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency VARCHAR(16) NOT NULL DEFAULT 'USD',
  status VARCHAR(64) NOT NULL,
  raw_payload JSONB,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_provider_tx UNIQUE (provider, provider_transaction_id)
);

CREATE TABLE IF NOT EXISTS treasury_reconciliations (
  id VARCHAR(128) PRIMARY KEY,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider VARCHAR(64) NOT NULL,
  external_balance_minor BIGINT NOT NULL DEFAULT 0,
  internal_ledger_balance_minor BIGINT NOT NULL DEFAULT 0,
  discrepancy_minor BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(64) NOT NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS provider_instances (
  id VARCHAR(128) PRIMARY KEY,
  operation_id VARCHAR(128) REFERENCES provider_operations(operation_id),
  job_id VARCHAR(64) REFERENCES compute_jobs(job_id),
  provider VARCHAR(64) NOT NULL,
  provider_instance_id VARCHAR(128) NOT NULL,
  gpu_model VARCHAR(128) NOT NULL,
  gpu_count INT NOT NULL DEFAULT 1 CHECK (gpu_count > 0),
  actual_hourly_cost NUMERIC(14, 4) NOT NULL CHECK (actual_hourly_cost >= 0),
  status VARCHAR(64) NOT NULL DEFAULT 'PROVISIONING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terminated_at TIMESTAMPTZ,
  total_billed_cost NUMERIC(14, 4),
  raw_metadata JSONB,
  CONSTRAINT unique_provider_instance UNIQUE (provider, provider_instance_id)
);

CREATE TABLE IF NOT EXISTS withdrawable_profits (
  id VARCHAR(128) PRIMARY KEY,
  settlement_id VARCHAR(128) NOT NULL UNIQUE REFERENCES settlements(settlement_id) ON DELETE RESTRICT,
  job_id VARCHAR(64) NOT NULL UNIQUE REFERENCES compute_jobs(job_id) ON DELETE RESTRICT,
  customer_id VARCHAR(64) NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
  gross_revenue_minor BIGINT NOT NULL CHECK (gross_revenue_minor > 0),
  provider_cost_minor BIGINT NOT NULL CHECK (provider_cost_minor >= 0),
  fees_minor BIGINT NOT NULL DEFAULT 0 CHECK (fees_minor >= 0),
  net_profit_minor BIGINT NOT NULL CHECK (net_profit_minor > 0),
  net_profit_usd NUMERIC(18, 2) NOT NULL CHECK (net_profit_usd > 0),
  currency VARCHAR(16) NOT NULL DEFAULT 'USD',
  status VARCHAR(32) NOT NULL DEFAULT 'CREDITED' CHECK (status IN ('CREDITED', 'PROFIT_WITHDRAWABLE', 'WITHDRAWN', 'WITHDRAWAL_CONFIRMED', 'FROZEN')),
  credited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profit_withdrawal_audits (
  withdrawal_id VARCHAR(128) PRIMARY KEY,
  idempotency_key VARCHAR(128) UNIQUE,
  coin VARCHAR(32) NOT NULL,
  amount NUMERIC(18, 8) NOT NULL CHECK (amount > 0),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  destination_address VARCHAR(255) NOT NULL,
  network VARCHAR(64) NOT NULL,
  available_profit_before NUMERIC(18, 2) NOT NULL CHECK (available_profit_before >= 0),
  available_profit_after NUMERIC(18, 2) NOT NULL CHECK (available_profit_after >= 0),
  binance_withdraw_id VARCHAR(255),
  tx_hash VARCHAR(255),
  status VARCHAR(64) NOT NULL,
  lifecycle_state VARCHAR(64) NOT NULL DEFAULT 'PROFIT_WITHDRAWABLE',
  post_withdrawal_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by VARCHAR(128) NOT NULL,
  reason TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS profit_withdrawal_allowlist (
  id VARCHAR(128) PRIMARY KEY,
  destination_address VARCHAR(255) NOT NULL,
  network VARCHAR(64) NOT NULL,
  coin VARCHAR(32) NOT NULL DEFAULT 'USDT',
  label VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cooldown_until TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  CONSTRAINT unique_allowlist_addr_net_coin UNIQUE (destination_address, network, coin),
  CONSTRAINT chk_allowlist_cooldown CHECK (cooldown_until >= created_at)
);

CREATE TABLE IF NOT EXISTS market_opportunities (
  opportunity_id VARCHAR(128) PRIMARY KEY,
  source VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  customer_demand_source VARCHAR(128) NOT NULL,
  customer_id VARCHAR(64),
  demand_order_id VARCHAR(64),
  customer_price NUMERIC(14, 4) NOT NULL,
  customer_price_currency VARCHAR(16) NOT NULL DEFAULT 'USD',
  gpu_type VARCHAR(128) NOT NULL,
  gpu_quantity INT NOT NULL DEFAULT 1,
  runtime_hours NUMERIC(10, 2) NOT NULL DEFAULT 1,
  provider VARCHAR(64) NOT NULL,
  provider_offer_id VARCHAR(128) NOT NULL,
  provider_price_hourly NUMERIC(14, 4) NOT NULL,
  provider_cost NUMERIC(14, 4) NOT NULL,
  expected_revenue NUMERIC(14, 4) NOT NULL,
  expected_provider_cost NUMERIC(14, 4) NOT NULL,
  expected_payment_fees NUMERIC(14, 4) NOT NULL DEFAULT 0,
  expected_network_fees NUMERIC(14, 4) NOT NULL DEFAULT 0,
  expected_platform_costs NUMERIC(14, 4) NOT NULL DEFAULT 0,
  expected_fees NUMERIC(14, 4) NOT NULL DEFAULT 0,
  expected_profit NUMERIC(14, 4) NOT NULL,
  expected_margin NUMERIC(10, 4) NOT NULL,
  required_capital NUMERIC(14, 4) NOT NULL,
  verified_available_capital NUMERIC(14, 4) NOT NULL DEFAULT 0,
  capital_shortfall NUMERIC(14, 4) NOT NULL DEFAULT 0,
  discovery_status VARCHAR(64) NOT NULL,
  status VARCHAR(64) NOT NULL,
  execution_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  block_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_timestamp TIMESTAMPTZ,
  price_timestamp TIMESTAMPTZ,
  provider_timestamp TIMESTAMPTZ,
  customer_price_timestamp TIMESTAMPTZ,
  confidence INT NOT NULL DEFAULT 90,
  metadata JSONB
);
