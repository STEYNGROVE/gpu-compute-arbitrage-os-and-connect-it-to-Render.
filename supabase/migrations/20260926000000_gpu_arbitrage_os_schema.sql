-- =============================================================================
-- GPU COMPUTE ARBITRAGE OS — AUTHORITATIVE SUPABASE POSTGRESQL SCHEMA
-- Target Project: https://dbqogkfrbvlvftoeydgq.supabase.co (dbqogkfrbvlvftoeydgq)
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) PRIMARY KEY,
  checksum VARCHAR(128) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. Registered Enterprise Customers
CREATE TABLE IF NOT EXISTS customers (
  customer_id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  kyc_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  credit_limit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Customer API Keys
CREATE TABLE IF NOT EXISTS customer_api_keys (
  key_id VARCHAR(64) PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  key_hash VARCHAR(128) NOT NULL UNIQUE,
  key_prefix VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
);
CREATE INDEX IF NOT EXISTS idx_customer_api_keys_hash ON customer_api_keys(key_hash);

-- 3. Customer & Admin Browser Sessions
CREATE TABLE IF NOT EXISTS customer_sessions (
  session_id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'CUSTOMER',
  customer_id VARCHAR(64),
  permissions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(64),
  user_agent TEXT
);

-- 4. Authoritative Demand Orders
CREATE TABLE IF NOT EXISTS demand_orders (
  id VARCHAR(64) PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL REFERENCES customers(customer_id),
  customer_name VARCHAR(255) NOT NULL,
  demand_class VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED',
  workload_type VARCHAR(64) NOT NULL,
  gpu_model VARCHAR(128) NOT NULL,
  min_vram_gb INT NOT NULL,
  gpu_count INT NOT NULL DEFAULT 1,
  duration_hours NUMERIC(10, 2) NOT NULL,
  deadline_minutes INT NOT NULL,
  customer_gross_offer_price NUMERIC(14, 2) NOT NULL,
  customer_hourly_rate NUMERIC(14, 4) NOT NULL,
  payment_status VARCHAR(64) NOT NULL,
  demand_source VARCHAR(64) NOT NULL,
  auth_signature VARCHAR(128) NOT NULL,
  escrow_reference_id VARCHAR(128),
  is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Webhook Events with Replay Protection
CREATE TABLE IF NOT EXISTS webhook_events (
  provider VARCHAR(64) NOT NULL,
  event_id VARCHAR(128) NOT NULL,
  order_id VARCHAR(64),
  customer_id VARCHAR(64),
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_payload JSONB,
  CONSTRAINT unique_webhook_event PRIMARY KEY (provider, event_id)
);

-- 6. Treasury Accounts
CREATE TABLE IF NOT EXISTS treasury_accounts (
  id VARCHAR(64) PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  external_account_id VARCHAR(128) NOT NULL,
  account_type VARCHAR(32) NOT NULL,
  account_class VARCHAR(32) NOT NULL DEFAULT 'ASSET',
  asset VARCHAR(16) NOT NULL,
  currency VARCHAR(16) NOT NULL,
  environment VARCHAR(16) NOT NULL DEFAULT 'LIVE',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_treasury_acct UNIQUE (provider, external_account_id, asset, environment)
);

-- 7. True Immutable Double-Entry Treasury Ledger
CREATE TABLE IF NOT EXISTS treasury_ledger (
  transaction_id VARCHAR(128) PRIMARY KEY,
  entry_group_id VARCHAR(128) NOT NULL,
  account_id VARCHAR(64) NOT NULL REFERENCES treasury_accounts(id),
  asset VARCHAR(16) NOT NULL,
  currency VARCHAR(16) NOT NULL,
  quantity NUMERIC(28, 8) NOT NULL CHECK (quantity > 0),
  precision INT NOT NULL CHECK (precision >= 0 AND precision <= 18),
  direction VARCHAR(16) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  transaction_type VARCHAR(32) NOT NULL,
  external_reference VARCHAR(128) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  operation_id VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  previous_hash VARCHAR(128) NOT NULL,
  record_hash VARCHAR(128) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_treasury_ledger_group ON treasury_ledger(entry_group_id);
CREATE INDEX IF NOT EXISTS idx_treasury_ledger_account ON treasury_ledger(account_id);

-- 8. Cryptographic Quote Locks
CREATE TABLE IF NOT EXISTS quotes (
  quote_id VARCHAR(128) PRIMARY KEY,
  customer_id VARCHAR(64) NOT NULL REFERENCES customers(customer_id),
  demand_order_id VARCHAR(64) NOT NULL REFERENCES demand_orders(id),
  provider VARCHAR(64) NOT NULL,
  offer_id VARCHAR(128) NOT NULL,
  gpu_model VARCHAR(128) NOT NULL,
  gpu_count INT NOT NULL DEFAULT 1,
  region VARCHAR(64) NOT NULL,
  duration_hours NUMERIC(10, 2) NOT NULL,
  verified_hourly_price NUMERIC(14, 4) NOT NULL,
  max_total_cost NUMERIC(14, 4) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  nonce VARCHAR(64) NOT NULL,
  signature VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ISSUED',
  consumed_at TIMESTAMPTZ,
  consumed_by VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_quote_status CHECK (status IN ('ISSUED', 'CONSUMED', 'EXPIRED', 'CANCELLED'))
);

-- 9. Capital Reservations
CREATE TABLE IF NOT EXISTS capital_reservations (
  reservation_id VARCHAR(128) PRIMARY KEY,
  demand_order_id VARCHAR(64) NOT NULL REFERENCES demand_orders(id),
  quote_id VARCHAR(128) NOT NULL REFERENCES quotes(quote_id),
  account_id VARCHAR(64) NOT NULL REFERENCES treasury_accounts(id),
  asset VARCHAR(16) NOT NULL,
  currency VARCHAR(16) NOT NULL,
  amount NUMERIC(28, 8) NOT NULL CHECK (amount >= 0),
  status VARCHAR(32) NOT NULL DEFAULT 'RESERVED',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_res_status CHECK (status IN ('REQUESTED', 'RESERVED', 'CONSUMED', 'RELEASED', 'EXPIRED', 'FAILED'))
);

-- 10. Provider Operations (Durable Saga State Machine)
CREATE TABLE IF NOT EXISTS provider_operations (
  operation_id VARCHAR(128) PRIMARY KEY,
  demand_order_id VARCHAR(64) NOT NULL REFERENCES demand_orders(id),
  quote_id VARCHAR(128) NOT NULL REFERENCES quotes(quote_id),
  reservation_id VARCHAR(128) REFERENCES capital_reservations(reservation_id),
  customer_id VARCHAR(64) NOT NULL REFERENCES customers(customer_id),
  provider VARCHAR(64) NOT NULL,
  offer_id VARCHAR(128) NOT NULL,
  gpu_model VARCHAR(128) NOT NULL,
  gpu_count INT NOT NULL,
  provider_instance_id VARCHAR(128),
  state VARCHAR(64) NOT NULL DEFAULT 'CREATED',
  idempotency_key VARCHAR(128) UNIQUE,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Compute Jobs
CREATE TABLE IF NOT EXISTS compute_jobs (
  job_id VARCHAR(64) PRIMARY KEY,
  operation_id VARCHAR(128) NOT NULL REFERENCES provider_operations(operation_id),
  demand_order_id VARCHAR(64) NOT NULL REFERENCES demand_orders(id),
  customer_id VARCHAR(64) NOT NULL REFERENCES customers(customer_id),
  provider VARCHAR(64) NOT NULL,
  provider_instance_id VARCHAR(128) NOT NULL,
  gpu_model VARCHAR(128) NOT NULL,
  gpu_count INT NOT NULL DEFAULT 1,
  contracted_revenue NUMERIC(14, 2) NOT NULL,
  provider_hourly_rate NUMERIC(14, 4) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'RUNNING',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  actual_duration_hours NUMERIC(10, 4),
  actual_cost NUMERIC(14, 4),
  billing_verified BOOLEAN NOT NULL DEFAULT FALSE,
  billing_reference VARCHAR(128),
  telemetry_status VARCHAR(32) NOT NULL DEFAULT 'LIVE_UNMEASURED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Settlements
CREATE TABLE IF NOT EXISTS settlements (
  settlement_id VARCHAR(128) PRIMARY KEY,
  job_id VARCHAR(64) NOT NULL UNIQUE REFERENCES compute_jobs(job_id),
  customer_id VARCHAR(64) NOT NULL REFERENCES customers(customer_id),
  gross_revenue NUMERIC(14, 2) NOT NULL,
  total_cost NUMERIC(14, 4) NOT NULL,
  net_profit NUMERIC(14, 4) NOT NULL,
  escrow_debited NUMERIC(14, 2) NOT NULL,
  provider_cost_paid NUMERIC(14, 4) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'SETTLED',
  idempotency_key VARCHAR(128) UNIQUE,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Transactional Outbox Pattern
CREATE TABLE IF NOT EXISTS outbox_events (
  id VARCHAR(128) PRIMARY KEY,
  aggregate_type VARCHAR(64) NOT NULL DEFAULT 'OPERATION',
  aggregate_id VARCHAR(128) NOT NULL DEFAULT '',
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  retry_count INT NOT NULL DEFAULT 0,
  claimed_by VARCHAR(64),
  claimed_at TIMESTAMPTZ,
  lease_timeout_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_events(status, lease_timeout_at);

-- 14. Idempotency Keys
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(128) PRIMARY KEY,
  endpoint VARCHAR(128) NOT NULL,
  status_code INT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Audit Event Log
CREATE TABLE IF NOT EXISTS audit_events (
  id VARCHAR(64) PRIMARY KEY,
  event_type VARCHAR(64) NOT NULL,
  severity VARCHAR(32) NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  prev_hash VARCHAR(128),
  verified_signature VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Reconciliation Runs & Snapshots
CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id VARCHAR(128) PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  asset VARCHAR(16) NOT NULL,
  external_balance NUMERIC(28, 8) NOT NULL,
  internal_balance NUMERIC(28, 8) NOT NULL,
  discrepancy NUMERIC(28, 8) NOT NULL,
  status VARCHAR(32) NOT NULL,
  reason TEXT,
  reconciled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treasury_snapshots (
  id VARCHAR(128) PRIMARY KEY,
  run_id VARCHAR(128) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  asset VARCHAR(32) NOT NULL,
  external_balance_minor BIGINT NOT NULL,
  internal_ledger_balance_minor BIGINT NOT NULL,
  discrepancy_minor BIGINT NOT NULL,
  valuation_usd NUMERIC(16, 2),
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- 17. Global Kill Switch & Circuit Breaker State
CREATE TABLE IF NOT EXISTS kill_switch_state (
  id VARCHAR(32) PRIMARY KEY DEFAULT 'GLOBAL_KILL_SWITCH',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT,
  activated_by VARCHAR(128),
  activated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  breaker_id VARCHAR(64) PRIMARY KEY,
  is_tripped BOOLEAN NOT NULL DEFAULT FALSE,
  tripped_at TIMESTAMPTZ,
  trip_reason TEXT,
  trigger_rule VARCHAR(64),
  severity VARCHAR(32) NOT NULL DEFAULT 'NORMAL',
  consecutive_failures INT NOT NULL DEFAULT 0,
  accumulated_loss_usd NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  unsettled_exposure_usd NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  reset_at TIMESTAMPTZ,
  reset_by VARCHAR(64),
  metadata JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
